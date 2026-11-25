// SPDX-License-Identifier: MIT
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
  emptyTierAcks,
  emptyTierEvidence,
  isTierNodeId,
  loadTierAcks,
  loadTierEvidence,
  recordTierAttempt,
  saveTierAcks,
  saveTierEvidence,
  type TierAcks,
  type TierEvidence,
  type TierNodeId,
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
  const [tierAcks, setTierAcks] = useState<TierAcks>(() => emptyTierAcks());
  const evidenceRef = useRef(evidence);
  const gatesRef = useRef(gates);
  const tierRef = useRef(tierEvidence);
  const tierAcksRef = useRef(tierAcks);
  evidenceRef.current = evidence;
  gatesRef.current = gates;
  tierRef.current = tierEvidence;
  tierAcksRef.current = tierAcks;

  useEffect(() => {
    const next = browserStore();
    store.current = next;
    setEvidence(loadEvidence(next));
    setGates(loadGates(next));
    setTierEvidence(loadTierEvidence(next));
    setTierAcks(loadTierAcks(next));
    setHydrated(true);
  }, []);

  const record = useCallback((event: AttemptEvent) => {
    const result = applyAttempt(evidenceRef.current, event, gatesRef.current, {
      evidence: tierRef.current,
      acknowledged: tierAcksRef.current["converging-fix"],
      acks: tierAcksRef.current,
    });
    evidenceRef.current = result.evidence;
    setEvidence(result.evidence);
    return result.newlyLit.map((id) => skillNodeById.get(id)?.label ?? id);
  }, []);

  const acknowledgeBarrage = useCallback((acknowledged: boolean) => {
    setGates((current) => withBarrageAcknowledgment(current, acknowledged));
  }, []);

  const acknowledgeTier = useCallback((nodeId: TierNodeId, acknowledged: boolean) => {
    if (!isTierNodeId(nodeId)) return;
    setTierAcks((current) => ({ ...current, [nodeId]: acknowledged }));
  }, []);

  const acknowledgeGrid = useCallback(
    (acknowledged: boolean) => {
      acknowledgeTier("converging-fix", acknowledged);
    },
    [acknowledgeTier],
  );

  const recordTier = useCallback((nodeId: TierNodeId, correct: boolean, elapsedMs: number) => {
    if (!isTierNodeId(nodeId) || tierAcksRef.current[nodeId] !== true) return false;
    setTierEvidence((current) => recordTierAttempt(current, nodeId, correct, elapsedMs));
    return true;
  }, []);

  const recordGrid = useCallback(
    (correct: boolean, elapsedMs: number) => recordTier("converging-fix", correct, elapsedMs),
    [recordTier],
  );

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
    saveTierAcks(store.current, tierAcks);
  }, [evidence, gates, tierEvidence, tierAcks, hydrated]);

  return useMemo(
    () => ({
      evidence,
      record,
      gates,
      acknowledgeBarrage,
      chooseBarrageDefinition,
      tierEvidence,
      tierAcks,
      gridAcknowledged: tierAcks["converging-fix"],
      acknowledgeGrid,
      acknowledgeTier,
      recordGrid,
      recordTier,
    }),
    [
      evidence,
      record,
      gates,
      acknowledgeBarrage,
      chooseBarrageDefinition,
      tierEvidence,
      tierAcks,
      acknowledgeGrid,
      acknowledgeTier,
      recordGrid,
      recordTier,
    ],
  );
}
