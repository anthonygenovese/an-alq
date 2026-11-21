import { memo, useEffect, useMemo, useRef, useState } from "react";
import { drawsFromRound } from "../../../src/sim/signature.js";
import type { TrainingRound } from "../../../src/sim/types.js";
import { formatMhz } from "../format.js";
import { Spectrogram } from "../gl/Spectrogram.js";

interface WaterfallProps {
  round: TrainingRound;
  paused: boolean;
}

export const Waterfall = memo(function Waterfall({ round, paused }: WaterfallProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scopeRef = useRef<Spectrogram | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const draws = useMemo(() => drawsFromRound(round), [round]);
  const primaryIndex = round.emitters.findIndex((emitter) => emitter.role === "primary");
  const primary = primaryIndex >= 0 ? draws[primaryIndex] : undefined;
  const bins = round.display.bins;
  const bracket = primary ? bracketBox(primary.centerBin, primary.widthBins, bins) : null;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    t,
    label: formatMhz(round.display.startMhz + (round.display.stopMhz - round.display.startMhz) * t),
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scope = new Spectrogram(canvas);
    scopeRef.current = scope;
    scope.setRound(round);
    scope.start();
    return () => {
      scope.destroy();
      scopeRef.current = null;
    };
  }, [round]);

  useEffect(() => {
    scopeRef.current?.setPaused(paused);
  }, [paused, round]);

  return (
    <div className="scope">
      <div
        className="scope-plot"
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const ratio = (event.clientX - rect.left) / rect.width;
          const mhz =
            round.display.startMhz + ratio * (round.display.stopMhz - round.display.startMhz);
          setHover(formatMhz(mhz));
        }}
        onMouseLeave={() => setHover(null)}
      >
        <canvas ref={canvasRef} aria-hidden="true" />
        {bracket ? (
          <div className="bracket" style={{ left: `${bracket.left}%`, width: `${bracket.width}%` }}>
            <span>UNKNOWN</span>
          </div>
        ) : null}
        <div className="scope-now">NOW</div>
        <div className="scope-readout">{hover ?? "sweep"}</div>
      </div>
      <div className="axis" aria-hidden="true">
        {ticks.map((tick) => (
          <span key={tick.t} style={{ left: `${tick.t * 100}%` }}>
            {tick.label}
          </span>
        ))}
      </div>
    </div>
  );
});

function bracketBox(
  centerBin: number,
  widthBins: number,
  bins: number,
): { left: number; width: number } {
  const rawLeft = ((centerBin - widthBins / 2) / bins) * 100;
  const rawRight = ((centerBin + widthBins / 2) / bins) * 100;
  const left = Math.max(0, Math.min(98, rawLeft));
  const right = Math.max(left + 1.5, Math.min(100, rawRight));
  return { left, width: right - left };
}
