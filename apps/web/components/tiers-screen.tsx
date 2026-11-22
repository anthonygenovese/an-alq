"use client";

import { TRAINING_DISCLAIMER } from "@an-alq/emitters";
import {
  TRAINER_TIERS,
  evaluateMap,
  skillMap,
  skillNodeById,
  useSkillEvidence,
  type NodeState,
  type SkillSnapshot,
} from "@an-alq/sim/catalog";

export function TiersScreen() {
  const { evidence, gates, tierEvidence, gridAcknowledged } = useSkillEvidence();
  const snapshot = evaluateMap(evidence, gates, {
    evidence: tierEvidence,
    acknowledged: gridAcknowledged,
  });
  const litWord = snapshot.litCount === 1 ? "node" : "nodes";

  return (
    <main className="tiers">
      <header className="tiers-top">
        <div>
          <p className="eyebrow">Tiers</p>
          <h1>T1 through T5</h1>
        </div>
        <p className="demo-flag">
          {snapshot.litCount} lit {litWord}
        </p>
      </header>
      <p className="tiers-note">{TRAINING_DISCLAIMER}</p>
      <p className="tiers-hint" role="status">
        {barrageHint(snapshot)}
      </p>
      <ol className="tier-list">
        {TRAINER_TIERS.map((tier) => {
          const nodes = skillMap.nodes.filter((node) => node.tier === tier.id);
          return (
            <li key={tier.id}>
              <div className="tier-head">
                <p className="signal-kicker">
                  <span>{tier.id}</span>
                  <span>{tierStatus(tier.status)}</span>
                </p>
                <h2>{tier.name}</h2>
                <p>{tier.summary}</p>
              </div>
              <ul className="node-list">
                {nodes.map((node) => {
                  const state =
                    snapshot.nodes.find((item) => item.id === node.id)?.state ?? "locked";
                  return (
                    <li key={node.id} className={`node-row is-${state}`}>
                      <span>{node.label}</span>
                      <span className="node-state">{stateLabel(state)}</span>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ol>
    </main>
  );
}

function barrageHint(snapshot: SkillSnapshot): string {
  const spec = skillNodeById.get("barrage-label");
  const status = snapshot.nodes.find((node) => node.id === "barrage-label");
  if (!spec || !status) return "The barrage node is not on this map.";
  if (status.state === "lit") return "The barrage node is a lit node.";
  const gates = spec.requires.map((id) => {
    const label = skillNodeById.get(id)?.label ?? id;
    const lit = snapshot.nodes.find((node) => node.id === id)?.state === "lit";
    return `${label} is ${lit ? "a lit node" : "not a lit node"}`;
  });
  const ready = spec.requires.every(
    (id) => snapshot.nodes.find((node) => node.id === id)?.state === "lit",
  );
  if (ready) {
    return `Those T1 nodes are lit. Next lit node: Barrage, from a glossary definition. ${gates.join(". ")}.`;
  }
  return `Next lit node: Barrage. It can become a lit node from a glossary definition after these T1 nodes are lit. ${gates.join(". ")}.`;
}

function stateLabel(state: NodeState): string {
  if (state === "lit") return "Lit";
  if (state === "open") return "Open";
  if (state === "sealed") return "Sealed";
  return "Locked";
}

function tierStatus(status: string): string {
  if (status.length === 0) return status;
  return status.charAt(0).toUpperCase() + status.slice(1);
}
