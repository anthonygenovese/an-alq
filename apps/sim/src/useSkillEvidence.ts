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

/**
 * The first render matches the server: an empty record. localStorage is read
 * after mount so a static export does not hydrate a different tree.
 */
export function useSkillEvidence() {
  const store = useRef<KeyValueStore | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [evidence, setEvidence] = useState<SkillEvidence>(() => loadEvidence(null));
  const [gates, setGates] = useState<SkillGates>(() => emptyGates());
  const evidenceRef = useRef(evidence);
  const gatesRef = useRef(gates);
  evidenceRef.current = evidence;
  gatesRef.current = gates;

  useEffect(() => {
    const next = browserStore();
    store.current = next;
    setEvidence(loadEvidence(next));
    setGates(loadGates(next));
    setHydrated(true);
  }, []);

  const record = useCallback((event: AttemptEvent) => {
    const result = applyAttempt(evidenceRef.current, event, gatesRef.current);
    evidenceRef.current = result.evidence;
    setEvidence(result.evidence);
    return result.newlyLit.map((id) => skillNodeById.get(id)?.label ?? id);
  }, []);

  const acknowledgeBarrage = useCallback((acknowledged: boolean) => {
    setGates((current) => withBarrageAcknowledgment(current, acknowledged));
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
  }, [evidence, gates, hydrated]);

  return useMemo(
    () => ({ evidence, record, gates, acknowledgeBarrage, chooseBarrageDefinition }),
    [evidence, record, gates, acknowledgeBarrage, chooseBarrageDefinition],
  );
}
