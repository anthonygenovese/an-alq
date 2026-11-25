// SPDX-License-Identifier: MIT
import type { EmitterCategory } from "@an-alq/emitters";
import { meanReactionMs, type SessionStats } from "../engine/scoring.js";

const CODE: Record<EmitterCategory, string> = {
  search_radar: "SRCH",
  fire_control_radar: "FC",
  tracking_radar: "TRK",
  early_warning_radar: "EW",
  navigation_radar: "NAV",
  weather_radar: "WX",
  radar_altimeter: "ALT",
  comms_fhss: "FHSS",
  comms_dsss: "DSSS",
  comms_lte: "LTE",
  satcom: "SAT",
  gnss: "GNSS",
  data_link: "LINK",
  hf_comms: "HF",
};

export function StatsStrip({ stats, accuracy }: { stats: SessionStats; accuracy: number }) {
  const mean = meanReactionMs(stats);
  return (
    <section className="strip" aria-label="Session stats">
      <div className="strip-figures">
        <Figure label="Acc" value={`${Math.round(accuracy * 100)}%`} />
        <Figure label="Mean" value={mean === null ? "—" : `${Math.round(mean)}`} unit="ms" />
        <Figure label="Streak" value={String(stats.streak)} />
        <Figure label="Best" value={String(stats.bestStreak)} />
        <Figure label="Score" value={String(stats.points)} />
      </div>
      <div className="cats">
        {stats.categories.map((track) => {
          const rate =
            track.attempts === 0 ? "—" : `${Math.round((track.correct / track.attempts) * 100)}%`;
          return (
            <div key={track.category} className="cat">
              <span>{CODE[track.category]}</span>
              <Spark recent={track.recent} />
              <b>{rate}</b>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Figure({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>
        {value}
        {unit ? <small>{unit}</small> : null}
      </strong>
    </div>
  );
}

function Spark({ recent }: { recent: readonly (0 | 1)[] }) {
  return (
    <svg className="spark" viewBox="0 0 64 14" aria-hidden="true">
      {Array.from({ length: 16 }, (_, index) => {
        const bit = recent[index];
        const x = index * 4;
        if (bit === undefined)
          return <rect key={index} x={x} y={12} width={2} height={1} className="spark-empty" />;
        return (
          <rect
            key={index}
            x={x}
            y={bit ? 1 : 7}
            width={2}
            height={bit ? 12 : 6}
            className={bit ? "spark-hit" : "spark-miss"}
          />
        );
      })}
    </svg>
  );
}
