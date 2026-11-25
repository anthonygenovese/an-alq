// SPDX-License-Identifier: MIT
import { useState } from "react";
import {
  generateConceptRound,
  isConceptNodeId,
  scoreConceptPick,
  type ConceptNodeId,
} from "../engine/concept-round.js";
import type { TierAcks, TierNodeId } from "../engine/tier-evidence.js";

const ACK: Record<ConceptNodeId, string> = {
  "tdoa-lines": "I acknowledge this is a glossary definition. It does not compute a fix.",
  "comms-fhss": "I acknowledge this is a glossary definition. Nothing is followed.",
  "collateral-rule": "I acknowledge this is a fictional board label. It is not an instruction.",
};

export function ConceptDrill({
  nodeId,
  state,
  acks,
  onAcknowledge,
  onAnswer,
}: {
  nodeId: string;
  state: "locked" | "sealed" | "open" | "lit";
  acks: TierAcks;
  onAcknowledge: (nodeId: TierNodeId, acknowledged: boolean) => void;
  onAnswer: (nodeId: TierNodeId, correct: boolean, elapsedMs: number) => boolean;
}) {
  const [seed, setSeed] = useState(1);
  const [shownAt, setShownAt] = useState(() => Date.now());
  const [note, setNote] = useState<string | null>(null);
  if (!isConceptNodeId(nodeId)) return null;
  if (state === "sealed") {
    return <p className="mono">This node opens after the required T1 nodes are lit.</p>;
  }
  if (state !== "open") return null;
  const conceptId = nodeId;
  const acknowledged = acks[conceptId];
  const round = generateConceptRound(conceptId, seed);
  const choose = (choiceId: string) => {
    if (!acknowledged) return;
    const grade = scoreConceptPick(round, choiceId, Date.now() - shownAt);
    const recorded = onAnswer(conceptId, grade.correct, grade.elapsedMs);
    setNote(
      recorded
        ? grade.correct
          ? "Definition matched. Illustrative. Not a procedure."
          : "That choice is a different entry. Nothing else was recorded."
        : "Acknowledge this node before an answer counts.",
    );
    setSeed((current) => current + 1);
    setShownAt(Date.now());
  };
  return (
    <form
      className="concept-drill"
      onSubmit={(event) => {
        event.preventDefault();
      }}
    >
      <label className="ack" htmlFor={`concept-ack-${conceptId}`}>
        <input
          id={`concept-ack-${conceptId}`}
          type="checkbox"
          checked={acknowledged}
          onChange={(event) => onAcknowledge(conceptId, event.target.checked)}
        />
        <span>{ACK[conceptId]}</span>
      </label>
      <p className="mono">{round.prompt}</p>
      <div className="concept-choices">
        {round.choices.map((choice) => (
          <button
            key={choice.id}
            type="button"
            className="definition-choice"
            disabled={!acknowledged}
            onClick={() => choose(choice.id)}
          >
            {choice.text}
          </button>
        ))}
      </div>
      {note ? <p className="miss">{note}</p> : null}
    </form>
  );
}
