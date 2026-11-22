import { useState } from "react";
import {
  cellOnLine,
  generateGridRound,
  scoreGridPick,
  type GridCell,
} from "../engine/grid-round.js";

export function GridDrill({
  state,
  acknowledged,
  onAcknowledge,
  onAnswer,
}: {
  state: "locked" | "sealed" | "open" | "lit";
  acknowledged: boolean;
  onAcknowledge: (acknowledged: boolean) => void;
  onAnswer: (correct: boolean, elapsedMs: number) => boolean;
}) {
  const [seed, setSeed] = useState(1);
  const [shownAt, setShownAt] = useState(() => Date.now());
  const [note, setNote] = useState<string | null>(null);
  if (state === "sealed") {
    return <p className="mono">This node opens after the required T1 nodes are lit.</p>;
  }
  if (state !== "open") return null;
  const round = generateGridRound(seed);
  const choose = (cell: GridCell) => {
    if (!acknowledged) return;
    const grade = scoreGridPick(round, cell, Date.now() - shownAt);
    const recorded = onAnswer(grade.correct, grade.elapsedMs);
    setNote(
      recorded
        ? grade.correct
          ? "Shared cell. Illustrative. Not a location."
          : "That cell is not the shared one. Nothing else was recorded."
        : "Acknowledge the fictional grid before a cell counts.",
    );
    setSeed((current) => current + 1);
    setShownAt(Date.now());
  };
  return (
    <form
      className="grid-drill"
      onSubmit={(event) => {
        event.preventDefault();
      }}
    >
      <label className="ack" htmlFor="grid-ack">
        <input
          id="grid-ack"
          type="checkbox"
          checked={acknowledged}
          onChange={(event) => onAcknowledge(event.target.checked)}
        />
        <span>
          I acknowledge this grid is fictional and illustrative. It is not a location and it does
          not compute a fix.
        </span>
      </label>
      <p className="mono">{round.prompt}</p>
      <div className="grid-board" role="group" aria-label="Fictional grid">
        {Array.from({ length: round.gridSize * round.gridSize }, (_, index) => {
          const cell = { col: index % round.gridSize, row: Math.floor(index / round.gridSize) };
          const onA = cellOnLine(round.lines[0].cells, cell);
          const onB = cellOnLine(round.lines[1].cells, cell);
          const mark = onA && onB ? "is-both" : onA || onB ? "is-line" : "";
          return (
            <button
              key={`${cell.col}-${cell.row}`}
              type="button"
              className={`grid-cell ${mark}`}
              disabled={!acknowledged}
              aria-label={`Cell row ${cell.row + 1} column ${cell.col + 1}`}
              onClick={() => choose(cell)}
            />
          );
        })}
      </div>
      {note ? <p className="miss">{note}</p> : null}
    </form>
  );
}
