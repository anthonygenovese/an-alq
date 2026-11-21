import { useEffect, useMemo, useState } from "react";
import {
  CATEGORY_LABELS,
  MODULATION_LABELS,
  SCAN_LABELS,
  emitterLibrary,
  type EmitterArchetype,
} from "../../../src/data/emitter-library.js";
import type { RoundFeedback } from "../../../src/sim/feedback.js";
import type { TrainingRound } from "../../../src/sim/types.js";
import type { Phase } from "../useTrainer.js";

interface ClassifierProps {
  round: TrainingRound;
  phase: Phase;
  answerId: string | null;
  feedback: RoundFeedback | null;
  onAnswer: (id: string) => void;
  onNext: () => void;
  litNodes?: readonly string[];
}

export function Classifier({ round, phase, answerId, feedback, onAnswer, onNext, litNodes = [] }: ClassifierProps) {
  const [query, setQuery] = useState("");
  useEffect(() => {
    setQuery("");
  }, [round.seed, round.difficulty, round.primaryId]);

  const shortlist = useMemo(
    () =>
      round.choices
        .map((id) => emitterLibrary.emitters.find((emitter) => emitter.id === id))
        .filter((emitter): emitter is EmitterArchetype => emitter !== undefined),
    [round.choices],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return shortlist;
    return emitterLibrary.emitters
      .filter((emitter) => {
        const haystack = [
          emitter.name,
          emitter.id,
          CATEGORY_LABELS[emitter.category],
          emitter.frequency.band,
          MODULATION_LABELS[emitter.modulation],
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(needle);
      })
      .slice(0, 8);
  }, [query, shortlist]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
      if ((event.key === "n" || event.key === "Enter") && phase === "feedback") {
        event.preventDefault();
        onNext();
        return;
      }
      if (phase === "feedback") return;
      const digit = Number.parseInt(event.key, 10);
      if (!Number.isInteger(digit) || digit < 1 || digit > visible.length) return;
      const choice = visible[digit - 1];
      if (!choice) return;
      event.preventDefault();
      onAnswer(choice.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onAnswer, onNext, phase, visible]);

  return (
    <section className="classify" aria-label="Classification">
      <div className="classify-head">
        <h2>Classify</h2>
        <p>{query.trim() ? "Library search" : `${shortlist.length} shortlist`}</p>
      </div>
      <label className="search">
        <span>Search the library</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Name, band, modulation"
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <div className="cards" role="listbox" aria-label="Emitter choices">
        {visible.length === 0 ? <p className="empty">No archetypes match.</p> : null}
        {visible.map((emitter, index) => {
          const picked = answerId === emitter.id;
          const correct = phase === "feedback" && emitter.id === round.primaryId;
          const wrong = phase === "feedback" && picked && !correct;
          return (
            <button
              key={emitter.id}
              type="button"
              role="option"
              aria-selected={picked}
              disabled={phase === "feedback"}
              className={["card", correct ? "is-correct" : "", wrong ? "is-wrong" : ""].filter(Boolean).join(" ")}
              onClick={() => onAnswer(emitter.id)}
            >
              <span className="card-key">{index < 8 ? index + 1 : ""}</span>
              <span className="card-copy">
                <strong>{emitter.name}</strong>
                <em>
                  {CATEGORY_LABELS[emitter.category]} · {emitter.frequency.band}
                </em>
                <small>
                  {MODULATION_LABELS[emitter.modulation]} · {SCAN_LABELS[emitter.scanType]}
                </small>
              </span>
            </button>
          );
        })}
      </div>
      <div className="feedback" aria-live="polite">
        {feedback ? (
          <>
            <h3 className={feedback.correct ? "ok" : "bad"}>{feedback.headline}</h3>
            <p>{feedback.explanation}</p>
            {feedback.contrast ? <p>{feedback.contrast}</p> : null}
            {feedback.glossary.map((entry) => (
              <p key={entry.id} className="gloss">
                <strong>{entry.term}.</strong> {entry.definition}
              </p>
            ))}
            <p className="gloss">{feedback.responseNote}</p>
            {litNodes.length > 0 ? <p className="lit-note">Node lit · {litNodes.join(" · ")}</p> : null}
            <button type="button" className="next" onClick={onNext}>
              Next trace
            </button>
          </>
        ) : (
          <p className="hint">Keys 1–{Math.min(8, Math.max(4, visible.length))} answer. Latency prints in ms. N next. Space pause.</p>
        )}
      </div>
    </section>
  );
}
