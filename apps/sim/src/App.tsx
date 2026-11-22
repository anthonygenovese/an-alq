import { useEffect, useState } from "react";
import { TRAINING_DISCLAIMER } from "@an-alq/emitters";
import { evaluateMap, suggestedDifficulty } from "./engine/skill-map.js";
import { Classifier } from "./components/Classifier.js";
import { Hud } from "./components/Hud.js";
import { SkillMap } from "./components/SkillMap.js";
import { Waterfall } from "./components/Waterfall.js";
import { useSkillEvidence } from "./useSkillEvidence.js";
import { useTrainer } from "./useTrainer.js";

type Surface = "map" | "range";

export function App() {
  const skills = useSkillEvidence();
  const trainer = useTrainer({
    onGraded: (event) => skills.record(event),
  });
  const [surface, setSurface] = useState<Surface>("map");
  const snapshot = evaluateMap(skills.evidence, skills.gates, {
    evidence: skills.tierEvidence,
    acknowledged: skills.gridAcknowledged,
    acks: skills.tierAcks,
  });
  const togglePaused = trainer.togglePaused;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
      if (event.key === " " && surface === "range") {
        event.preventDefault();
        togglePaused();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [surface, togglePaused]);

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <p className="eyebrow">AN-ALQ</p>
          <h1>Range Trainer</h1>
        </div>
        <div className="top-actions">
          <div className="view-switch" role="tablist" aria-label="Surface">
            <button
              type="button"
              role="tab"
              aria-selected={surface === "map"}
              className={surface === "map" ? "is-on" : ""}
              onClick={() => setSurface("map")}
            >
              Skill map
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={surface === "range"}
              className={surface === "range" ? "is-on" : ""}
              onClick={() => setSurface("range")}
            >
              T1 range
            </button>
          </div>
          <p className="lit-count">
            {snapshot.litCount} lit {snapshot.litCount === 1 ? "node" : "nodes"}
          </p>
        </div>
      </header>
      <div className="banner" role="note">
        {TRAINING_DISCLAIMER}
      </div>
      <main>
        {surface === "map" ? (
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
            onEnterRange={(nodeId) => {
              const difficulty = suggestedDifficulty(nodeId);
              if (difficulty) trainer.setDifficulty(difficulty);
              setSurface("range");
            }}
          />
        ) : (
          <div className="stage">
            <section className="scope-column" aria-label="Spectral waterfall">
              <div className="scope-title">
                <h2>T1 · Spectral classify</h2>
                <p>Time-compressed synthetic waterfall. The bracket is the unknown.</p>
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
        )}
      </main>
    </div>
  );
}
