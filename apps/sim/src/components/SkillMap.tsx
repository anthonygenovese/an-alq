import { useState } from "react";
import { resolveGlossaryEntry } from "@an-alq/emitters";
import {
  barrageDefinitionQuestion,
  nodePosition,
  participationRingOpacity,
  sectorCenter,
  skillMap,
  skillNodeById,
  type NodeState,
  type ParticipationGlow,
  type SkillGates,
  type SkillSnapshot,
} from "../engine/skill-map.js";
import { ConceptDrill } from "./ConceptDrill.js";
import { GridDrill } from "./GridDrill.js";
import type { TierAcks, TierNodeId } from "../engine/tier-evidence.js";

const EMPTY_GLOW: ParticipationGlow = { intensity: null };

interface SkillMapProps {
  snapshot: SkillSnapshot;
  gates: SkillGates;
  onEnterRange: (nodeId: string) => void;
  onAcknowledgeBarrage: (acknowledged: boolean) => void;
  onChooseBarrageDefinition: (choiceId: string) => boolean;
  gridAcknowledged: boolean;
  onAcknowledgeGrid: (acknowledged: boolean) => void;
  onGridAnswer: (correct: boolean, elapsedMs: number) => boolean;
  tierAcks: TierAcks;
  onAcknowledgeConcept: (nodeId: TierNodeId, acknowledged: boolean) => void;
  onConceptAnswer: (nodeId: TierNodeId, correct: boolean, elapsedMs: number) => boolean;
  participation?: ParticipationGlow;
}

export function SkillMap({
  snapshot,
  gates,
  onEnterRange,
  onAcknowledgeBarrage,
  onChooseBarrageDefinition,
  gridAcknowledged,
  onAcknowledgeGrid,
  onGridAnswer,
  tierAcks,
  onAcknowledgeConcept,
  onConceptAnswer,
  participation = EMPTY_GLOW,
}: SkillMapProps) {
  const [selectedId, setSelectedId] = useState("open-ear");
  const selected = skillNodeById.get(selectedId) ?? skillMap.nodes[0];
  const domain = skillMap.domains.find((item) => item.id === selected?.domainId);
  const status = snapshot.nodes.find((node) => node.id === selected?.id);
  const glow = participationRingOpacity(participation);
  const byState = new Map(snapshot.nodes.map((node) => [node.id, node]));

  if (!selected || !status) return null;

  return (
    <div className="map-screen">
      <div className="chart-wrap">
        <svg className="chart" viewBox="-280 -280 560 560" role="group" aria-label="EW skill map">
          <g className="ticks" aria-hidden="true">
            {Array.from({ length: 72 }, (_, index) => {
              const major = index % 6 === 0;
              const angle = index * 5;
              const outer = skillMap.tickRing;
              const inner = outer - (major ? 9 : 4);
              const start = nodePosition(angle, inner);
              const end = nodePosition(angle, outer);
              return (
                <line
                  key={angle}
                  x1={start.x}
                  y1={start.y}
                  x2={end.x}
                  y2={end.y}
                  className={major ? "tick major" : "tick"}
                />
              );
            })}
          </g>
          <g className="rings" aria-hidden="true">
            <circle r={skillMap.tickRing} />
            {skillMap.rings.map((radius) => (
              <circle key={radius} r={radius} />
            ))}
          </g>
          <g className="edges" aria-hidden="true">
            {skillMap.nodes.flatMap((node) =>
              node.requires.map((requirement) => {
                const from = pointFor(requirement);
                const to = pointFor(node.id);
                if (!from || !to) return null;
                const parent = byState.get(requirement)?.state;
                const child = byState.get(node.id)?.state;
                const lit = parent === "lit" && child === "lit";
                return (
                  <line
                    key={`${requirement}-${node.id}`}
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    className={lit ? "edge is-lit" : "edge"}
                  />
                );
              }),
            )}
          </g>
          <g className="domain-labels" aria-hidden="true">
            {skillMap.domains.map((domain) => {
              const position = nodePosition(sectorCenter(domain.startDeg, domain.endDeg), 256);
              return (
                <text
                  key={domain.id}
                  x={position.x}
                  y={position.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {DOMAIN_MARK[domain.id] ?? domain.name}
                </text>
              );
            })}
          </g>
          <g className="nodes">
            {skillMap.nodes.map((node) => {
              const point = pointFor(node.id);
              const nodeStatus = byState.get(node.id);
              if (!point || !nodeStatus) return null;
              const state = nodeStatus.state;
              return (
                <g
                  key={node.id}
                  className={`skill-node is-${state} ${selectedId === node.id ? "is-selected" : ""}`}
                  transform={`translate(${point.x} ${point.y})`}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selectedId === node.id}
                  aria-label={`${node.label}, ${stateLabel(state)}`}
                  onClick={() => setSelectedId(node.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedId(node.id);
                    }
                  }}
                >
                  <circle r="11" className="hit" />
                  {selectedId === node.id ? <circle r="8" className="select-ring" /> : null}
                  {node.shape === "diamond" ? (
                    <Diamond state={state} fraction={nodeStatus.fraction} />
                  ) : (
                    <Dot state={state} fraction={nodeStatus.fraction} />
                  )}
                  <NodeLabel angle={node.angleDeg} label={node.mark} state={state} />
                </g>
              );
            })}
          </g>
          <g className="profile" data-slot="participation-glow-ring">
            <circle r="18" className="profile-ring" />
            <circle r="27" className="profile-slot" />
            <circle r="27" className="profile-glow" style={{ opacity: glow }} />
            <line x1="-5" y1="0" x2="5" y2="0" />
            <line x1="0" y1="-5" x2="0" y2="5" />
            <title>Profile. The participation ring is empty until a later module fills it.</title>
          </g>
        </svg>
      </div>
      <aside className="dossier" aria-live="polite">
        <p className="eyebrow">{domain?.name ?? "Constellation"}</p>
        <h2>{selected.label}</h2>
        <p className="state-line">{stateLabel(status.state)}</p>
        <p>{selected.detail}</p>
        <p className="mono">{progressCopy(status, selected.criterion)}</p>
        {selected.requires.length > 0 ? (
          <p className="mono">
            Requires {selected.requires.map((id) => skillNodeById.get(id)?.label ?? id).join(" · ")}
          </p>
        ) : null}
        {selected.criterion.source === "glossary" && status.state !== "lit"
          ? null
          : selected.glossaryTerms.map((term) => {
              const entry = resolveGlossaryEntry(term);
              if (!entry) return null;
              return (
                <p key={term} className="gloss">
                  <strong>{entry.term}.</strong> {entry.definition}
                </p>
              );
            })}
        {selected.criterion.source === "glossary" ? (
          <BarrageDefinition
            state={status.state}
            gates={gates}
            onAcknowledge={onAcknowledgeBarrage}
            onChoose={onChooseBarrageDefinition}
          />
        ) : selected.criterion.source === "grid" ? (
          <GridDrill
            state={status.state}
            acknowledged={gridAcknowledged}
            onAcknowledge={onAcknowledgeGrid}
            onAnswer={onGridAnswer}
          />
        ) : selected.criterion.source === "concept" ? (
          <ConceptDrill
            nodeId={selected.id}
            state={status.state}
            acks={tierAcks}
            onAcknowledge={onAcknowledgeConcept}
            onAnswer={onConceptAnswer}
          />
        ) : (
          <button
            type="button"
            className="enter"
            disabled={status.state === "locked"}
            onClick={() => onEnterRange(selected.id)}
          >
            {status.state === "locked" ? "Locked preview" : "Enter T1 range"}
          </button>
        )}
        <p className="hint">
          A lit node is a skill you have mastered. The ring around the profile mark is reserved.
        </p>
      </aside>
    </div>
  );
}

function Diamond({ state, fraction }: { state: NodeState; fraction: number }) {
  return (
    <g aria-hidden="true">
      {fraction > 0 && state !== "locked" ? (
        <path
          d="M 0 -4.2 L 4.2 0 L 0 4.2 L -4.2 0 Z"
          className="fill"
          transform={`scale(${Math.max(0.2, fraction)})`}
        />
      ) : null}
      <path d="M 0 -4.2 L 4.2 0 L 0 4.2 L -4.2 0 Z" className="mark" />
    </g>
  );
}

function Dot({ state, fraction }: { state: NodeState; fraction: number }) {
  return (
    <g aria-hidden="true">
      {fraction > 0 && state !== "locked" ? (
        <circle r={2.6 * Math.max(0.25, fraction)} className="fill" />
      ) : null}
      <circle r="2.7" className="mark" />
    </g>
  );
}

function NodeLabel({ angle, label, state }: { angle: number; label: string; state: NodeState }) {
  const place = nodePosition(angle, 15);
  const anchor =
    angle > 40 && angle < 140 ? "start" : angle > 220 && angle < 320 ? "end" : "middle";
  return (
    <text
      className="node-label"
      x={place.x}
      y={place.y}
      textAnchor={anchor}
      dominantBaseline="middle"
      data-state={state}
    >
      {label}
    </text>
  );
}

function pointFor(id: string): { x: number; y: number } | null {
  const node = skillNodeById.get(id);
  if (!node) return null;
  const radius = skillMap.rings[node.ring];
  if (radius === undefined) return null;
  return nodePosition(node.angleDeg, radius);
}

const DOMAIN_MARK: Record<string, string> = {
  sigint: "SIGINT",
  geolocation: "TDOA / AOA",
  "radar-response": "RADAR",
  "comms-disruption": "COMMS",
  deception: "DECEPTION",
  "multi-threat": "MULTI",
};

function stateLabel(state: NodeState): string {
  if (state === "lit") return "Lit";
  if (state === "open") return "Open";
  if (state === "sealed") return "Sealed";
  return "Locked";
}

function BarrageDefinition({
  state,
  gates,
  onAcknowledge,
  onChoose,
}: {
  state: NodeState;
  gates: SkillGates;
  onAcknowledge: (acknowledged: boolean) => void;
  onChoose: (choiceId: string) => boolean;
}) {
  const [miss, setMiss] = useState(false);
  if (state === "sealed") {
    return <p className="mono">This node opens after the required T1 nodes are lit.</p>;
  }
  if (state !== "open") return null;
  const question = barrageDefinitionQuestion();
  return (
    <form
      className="definition-list"
      onSubmit={(event) => {
        event.preventDefault();
      }}
    >
      <label className="ack" htmlFor="barrage-ack">
        <input
          id="barrage-ack"
          type="checkbox"
          checked={gates.barrageLabel}
          onChange={(event) => {
            setMiss(false);
            onAcknowledge(event.target.checked);
          }}
        />
        <span>
          I acknowledge this node is an illustrative glossary definition. It is non-operational. It
          does not transmit.
        </span>
      </label>
      <fieldset disabled={!gates.barrageLabel}>
        <legend>{question.prompt}</legend>
        {question.choices.map((choice) => (
          <button
            key={choice.id}
            type="button"
            className="definition-choice"
            onClick={() => {
              const accepted = onChoose(choice.id);
              setMiss(!accepted);
            }}
          >
            {choice.definition}
          </button>
        ))}
      </fieldset>
      {miss ? (
        <p className="miss">That paragraph is a different glossary entry. Nothing was recorded.</p>
      ) : null}
    </form>
  );
}

function progressCopy(
  status: SkillSnapshot["nodes"][number],
  criterion: NonNullable<ReturnType<typeof skillNodeById.get>>["criterion"],
): string {
  if (criterion.source === "unavailable") return "No drill writes this constellation yet.";
  if (criterion.source === "glossary") {
    if (status.state === "lit") return "Definition matched. Illustrative. Not a procedure.";
    if (status.state === "sealed") return "Opens after the required T1 nodes are lit.";
    return "Acknowledge, then choose the glossary definition.";
  }
  if (status.state === "lit") return "Mastered from range performance.";
  const speed =
    criterion.maxMeanCorrectMs === null
      ? "no speed gate"
      : `mean under ${criterion.maxMeanCorrectMs} ms`;
  const accuracy = `${Math.round(criterion.minAccuracy * 100)}%`;
  return `${status.attempts}/${criterion.minAttempts} attempts · ${Math.round(status.accuracy * 100)}% accuracy · gate ${accuracy}, ${speed}`;
}
