import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyAttempt,
  browserStore,
  emptyGates,
  loadEvidence,
  loadGates,
  saveEvidence,
  saveGates,
  skillNodeById,
  barrageDefinitionQuestion,
  withBarrageAcknowledgment,
  withBarrageDefinition,
  type AttemptEvent,
  type KeyValueStore,
  type SkillEvidence,
  type SkillGates,
} from "./engine/skill-map.js";
import {
  emptyTierEvidence,
  loadTierAcknowledgment,
  loadTierEvidence,
  recordGridAttempt,
  saveTierAcknowledgment,
  saveTierEvidence,
  type TierEvidence,
} from "./engine/tier-evidence.js";

/**
 * The first render matches the server: an empty record. localStorage is read
 * after mount so a static export does not hydrate a different tree.
 */
export function useSkillEvidence() {
  const store = useRef<KeyValueStore | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [evidence, setEvidence] = useState<SkillEvidence>(() => loadEvidence(null));
  const [gates, setGates] = useState<SkillGates>(() => emptyGates());
  const [tierEvidence, setTierEvidence] = useState<TierEvidence>(() => emptyTierEvidence());
  const [gridAcknowledged, setGridAcknowledged] = useState(false);
  const evidenceRef = useRef(evidence);
  const gatesRef = useRef(gates);
  const tierRef = useRef(tierEvidence);
  const gridAckRef = useRef(gridAcknowledged);
  evidenceRef.current = evidence;
  gatesRef.current = gates;
  tierRef.current = tierEvidence;
  gridAckRef.current = gridAcknowledged;

  useEffect(() => {
    const next = browserStore();
    store.current = next;
    setEvidence(loadEvidence(next));
    setGates(loadGates(next));
    setTierEvidence(loadTierEvidence(next));
    setGridAcknowledged(loadTierAcknowledgment(next));
    setHydrated(true);
  }, []);

  const record = useCallback((event: AttemptEvent) => {
    const result = applyAttempt(evidenceRef.current, event, gatesRef.current, {
      evidence: tierRef.current,
      acknowledged: gridAckRef.current,
    });
    evidenceRef.current = result.evidence;
    setEvidence(result.evidence);
    return result.newlyLit.map((id) => skillNodeById.get(id)?.label ?? id);
  }, []);

  const acknowledgeBarrage = useCallback((acknowledged: boolean) => {
    setGates((current) => withBarrageAcknowledgment(current, acknowledged));
  }, []);

  const acknowledgeGrid = useCallback((acknowledged: boolean) => {
    setGridAcknowledged(acknowledged);
  }, []);

  const recordGrid = useCallback((correct: boolean, elapsedMs: number) => {
    if (!gridAckRef.current) return false;
    setTierEvidence((current) => recordGridAttempt(current, correct, elapsedMs));
    return true;
  }, []);

  const chooseBarrageDefinition = useCallback((choiceId: string) => {
    const current = gatesRef.current;
    const next = withBarrageDefinition(current, choiceId);
    if (next !== current) setGates(next);
    return (
      current.barrageLabel &&
      next.barrageDefinition &&
      choiceId === barrageDefinitionQuestion().answerId
    );
  }, []);

  useEffect(() => {
    if (!hydrated || !store.current) return;
    saveEvidence(store.current, evidence);
    saveGates(store.current, gates);
    saveTierEvidence(store.current, tierEvidence);
    saveTierAcknowledgment(store.current, gridAcknowledged);
  }, [evidence, gates, tierEvidence, gridAcknowledged, hydrated]);

  return useMemo(
    () => ({
      evidence,
      record,
      gates,
      acknowledgeBarrage,
      chooseBarrageDefinition,
      tierEvidence,
      gridAcknowledged,
      acknowledgeGrid,
      recordGrid,
    }),
    [
      evidence,
      record,
      gates,
      acknowledgeBarrage,
      chooseBarrageDefinition,
      tierEvidence,
      gridAcknowledged,
      acknowledgeGrid,
      recordGrid,
    ],
  );
}
