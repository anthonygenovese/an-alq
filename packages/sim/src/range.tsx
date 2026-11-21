"use client";

import { useEffect } from "react";
import { TRAINING_DISCLAIMER } from "@an-alq/emitters";
import { Classifier } from "./components/Classifier.js";
import { Hud } from "./components/Hud.js";
import { Waterfall } from "./components/Waterfall.js";
import { evaluateMap, suggestedDifficulty } from "./engine/skill-map.js";
import { useSkillEvidence } from "./useSkillEvidence.js";
import { useTrainer } from "./useTrainer.js";
import "./styles.css";

/** T1 waterfall. Progress is written to localStorage by the skill-evidence hook. */
export function RangeTrainer({ nodeId = null }: { nodeId?: string | null }) {
  const skills = useSkillEvidence();
  const trainer = useTrainer({
    onGraded: (event) => skills.record(event),
  });
  const setDifficulty = trainer.setDifficulty;
  const snapshot = evaluateMap(skills.evidence);

  useEffect(() => {
    if (!nodeId) return;
    const difficulty = suggestedDifficulty(nodeId);
    if (difficulty) setDifficulty(difficulty);
  }, [nodeId, setDifficulty]);

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <p className="eyebrow">T1</p>
          <h1>Spectral classify</h1>
        </div>
        <p className="lit-count">
          {snapshot.litCount} lit {snapshot.litCount === 1 ? "node" : "nodes"}
        </p>
      </header>
      <div className="banner" role="note">
        {TRAINING_DISCLAIMER}
      </div>
      <main>
        <div className="stage">
          <section className="scope-column" aria-label="Spectral waterfall">
            <div className="scope-title">
              <h2>Synthetic waterfall</h2>
              <p>Time-compressed. The bracket is the unknown.</p>
            </div>
            <Waterfall round={trainer.round} paused={trainer.paused} />
            <p className="caption">
              Dashes and hops are slowed so the shape can be seen. Frequencies, PRI, and SNR are
              illustrative.
            </p>
          </section>
          <div className="side">
            <Hud trainer={trainer} />
            <Classifier
              round={trainer.round}
              phase={trainer.phase}
              answerId={trainer.answerId}
              feedback={trainer.feedback}
              litNodes={trainer.litNodes}
              onAnswer={trainer.answer}
              onNext={trainer.next}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
