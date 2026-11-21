import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyAttempt,
  browserStore,
  loadEvidence,
  saveEvidence,
  skillNodeById,
  type AttemptEvent,
  type SkillEvidence,
} from "../../src/sim/skill-map.js";

export function useSkillEvidence() {
  const store = useRef(browserStore());
  const [evidence, setEvidence] = useState<SkillEvidence>(() => loadEvidence(store.current));
  const evidenceRef = useRef(evidence);
  evidenceRef.current = evidence;

  const record = useCallback((event: AttemptEvent) => {
    const result = applyAttempt(evidenceRef.current, event);
    evidenceRef.current = result.evidence;
    setEvidence(result.evidence);
    return result.newlyLit.map((id) => skillNodeById.get(id)?.label ?? id);
  }, []);

  useEffect(() => {
    if (store.current) saveEvidence(store.current, evidence);
  }, [evidence]);

  return useMemo(() => ({ evidence, record }), [evidence, record]);
}
