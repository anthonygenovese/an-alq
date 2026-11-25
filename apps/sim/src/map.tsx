// SPDX-License-Identifier: MIT
"use client";

import { TRAINING_DISCLAIMER } from "@an-alq/emitters";
import { SkillMap } from "./components/SkillMap.js";
import { evaluateMap } from "./engine/skill-map.js";
import { useSkillEvidence } from "./useSkillEvidence.js";
import "./styles.css";

/** Skill map. A node the player has mastered is a lit node. Evidence stays on device. */
export function SkillMapScreen({ onEnterRange }: { onEnterRange: (nodeId: string) => void }) {
  const skills = useSkillEvidence();
  const snapshot = evaluateMap(skills.evidence, skills.gates, {
    evidence: skills.tierEvidence,
    acknowledged: skills.gridAcknowledged,
    acks: skills.tierAcks,
  });

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <p className="eyebrow">AN-ALQ</p>
          <h1>Skill map</h1>
        </div>
        <p className="lit-count">
          {snapshot.litCount} lit {snapshot.litCount === 1 ? "node" : "nodes"}
        </p>
      </header>
      <div className="banner" role="note">
        {TRAINING_DISCLAIMER}
      </div>
      <main>
        <SkillMap
          snapshot={snapshot}
          gates={skills.gates}
          onAcknowledgeBarrage={skills.acknowledgeBarrage}
          onChooseBarrageDefinition={skills.chooseBarrageDefinition}
          gridAcknowledged={skills.gridAcknowledged}
          onAcknowledgeGrid={skills.acknowledgeGrid}
          onGridAnswer={skills.recordGrid}
          tierAcks={skills.tierAcks}
          onAcknowledgeConcept={skills.acknowledgeTier}
          onConceptAnswer={skills.recordTier}
          onEnterRange={onEnterRange}
        />
      </main>
    </div>
  );
}
