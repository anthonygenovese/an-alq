import { useEffect, useRef } from "react";
import { emitterById } from "@an-alq/emitters";
import { CLASSIFY_WINDOW_MS, type Difficulty } from "../engine/types.js";
import { COLORMAP_CSS } from "../colormap.js";
import { StatsStrip } from "./StatsStrip.js";
import { formatBandwidth, formatMhz, formatUs, titleCaseToken } from "../format.js";
import type { Trainer } from "../useTrainer.js";

const DIFFICULTIES: ReadonlyArray<{ id: Difficulty; label: string; blurb: string }> = [
  { id: "recruit", label: "Recruit", blurb: "One strong trace, precise readout" },
  { id: "operator", label: "Operator", blurb: "Distractors and rounded figures" },
  { id: "lead", label: "Lead", blurb: "Overlap, coarse readout" },
];

export function Hud({ trainer }: { trainer: Trainer }) {
  const primary = trainer.round.emitters.find((emitter) => emitter.role === "primary");
  const archetype = emitterById(trainer.round.primaryId);
  const observation = trainer.round.observation;
  const grade = trainer.grade;
  const subscribe = trainer.subscribe;
  const clockRef = useRef<HTMLElement>(null);
  const ringRef = useRef<SVGCircleElement>(null);
  const labelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const write = (text: string, state: string, fraction: number) => {
      if (clockRef.current) {
        clockRef.current.textContent = text;
        clockRef.current.dataset.state = state;
      }
      if (ringRef.current) {
        ringRef.current.style.strokeDashoffset = String(201.06 * (1 - fraction));
      }
    };
    if (grade) {
      const timeout = grade.reason === "timeout";
      write(
        timeout ? "2000" : String(Math.round(grade.elapsedMs)),
        grade.correct ? "ok" : "bad",
        timeout ? 0 : Math.max(0, (CLASSIFY_WINDOW_MS - grade.elapsedMs) / CLASSIFY_WINDOW_MS),
      );
      if (labelRef.current) labelRef.current.textContent = timeout ? "TIME" : "RT";
      return;
    }
    if (labelRef.current) labelRef.current.textContent = "LEFT";
    return subscribe((sample) => {
      write(
        sample.acquire ? "LOCK" : String(Math.ceil(sample.remainingMs)),
        sample.acquire ? "lock" : sample.remainingMs < 500 ? "hot" : "live",
        sample.acquire ? 1 : sample.remainingMs / CLASSIFY_WINDOW_MS,
      );
    });
  }, [grade, subscribe]);

  return (
    <aside className="hud">
      <StatsStrip stats={trainer.stats} accuracy={trainer.accuracy} />

      <div className="timer" role="timer" aria-label="Classification window and reaction time">
        <svg viewBox="0 0 80 80" aria-hidden="true">
          <circle cx="40" cy="40" r="32" className="ring-track" />
          <circle ref={ringRef} cx="40" cy="40" r="32" className="ring-value" />
        </svg>
        <div>
          <span ref={labelRef} className="clock-kicker">
            LEFT
          </span>
          <strong ref={clockRef} className="clock-value">
            2000
          </strong>
          <span>ms</span>
        </div>
      </div>

      <div className="readout">
        <div className="readout-head">
          <h2>Synthetic readout</h2>
          <span className={`conf conf-${observation.confidence}`}>{observation.confidence}</span>
        </div>
        <dl>
          <div>
            <dt>Band</dt>
            <dd>{observation.band}</dd>
          </div>
          <div>
            <dt>Center</dt>
            <dd>{formatMhz(observation.centerMhz)}</dd>
          </div>
          <div>
            <dt>Modulation</dt>
            <dd>{titleCaseToken(observation.modulation)}</dd>
          </div>
          <div>
            <dt>PRI</dt>
            <dd>{formatUs(observation.priUs)}</dd>
          </div>
          <div>
            <dt>Bandwidth</dt>
            <dd>{formatBandwidth(observation.bandwidthMhz)}</dd>
          </div>
          <div>
            <dt>Scan</dt>
            <dd>{observation.scan ? titleCaseToken(observation.scan) : "—"}</dd>
          </div>
          <div>
            <dt>Traces</dt>
            <dd>{trainer.round.emitters.length}</dd>
          </div>
          <div>
            <dt>SNR</dt>
            <dd>{primary ? `${primary.snrDb.toFixed(1)} dB` : "—"}</dd>
          </div>
        </dl>
        <p>{observation.notes}</p>
        {archetype?.hop && observation.confidence !== "low" ? (
          <p className="hop-note">
            Hop cartoon: {archetype.hop.channels} channels, {archetype.hop.rateHz} hops/s, span{" "}
            {formatBandwidth(archetype.hop.spanMhz)}. Channel width is the bandwidth above.
          </p>
        ) : null}
      </div>

      <div className="controls">
        <div className="diff" role="radiogroup" aria-label="Difficulty">
          {DIFFICULTIES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={trainer.difficulty === item.id}
              title={item.blurb}
              className={trainer.difficulty === item.id ? "is-on" : ""}
              onClick={() => trainer.setDifficulty(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="control-row">
          <button type="button" onClick={trainer.togglePaused}>
            {trainer.paused ? "Resume" : "Pause"}
          </button>
          <button type="button" onClick={trainer.newSession}>
            New session
          </button>
        </div>
        <p className="seed">
          Trace {trainer.index + 1} · seed {trainer.sessionSeed.toString(16).toUpperCase()} · round{" "}
          {trainer.round.seed.toString(16).toUpperCase()}
        </p>
      </div>

      <div className="legend" aria-hidden="true">
        <span>noise</span>
        <i style={{ background: COLORMAP_CSS }} />
        <span>strong</span>
      </div>
    </aside>
  );
}
