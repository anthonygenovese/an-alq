import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyAttempt,
  browserStore,
  loadEvidence,
  saveEvidence,
  skillNodeById,
  type AttemptEvent,
  type KeyValueStore,
  type SkillEvidence,
} from "./engine/skill-map.js";

/**
 * The first render matches the server: an empty record. localStorage is read
 * after mount so a static export does not hydrate a different tree.
 */
export function useSkillEvidence() {
  const store = useRef<KeyValueStore | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [evidence, setEvidence] = useState<SkillEvidence>(() => loadEvidence(null));
  const evidenceRef = useRef(evidence);
  evidenceRef.current = evidence;

  useEffect(() => {
    const next = browserStore();
    store.current = next;
    setEvidence(loadEvidence(next));
    setHydrated(true);
  }, []);

  const record = useCallback((event: AttemptEvent) => {
    const result = applyAttempt(evidenceRef.current, event);
    evidenceRef.current = result.evidence;
    setEvidence(result.evidence);
    return result.newlyLit.map((id) => skillNodeById.get(id)?.label ?? id);
  }, []);

  useEffect(() => {
    if (!hydrated || !store.current) return;
    saveEvidence(store.current, evidence);
  }, [evidence, hydrated]);

  return useMemo(() => ({ evidence, record }), [evidence, record]);
}
