// SPDX-License-Identifier: MIT
"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  areaPath,
  axisValues,
  cropIndices,
  fromX,
  nearestIndex,
  polylinePath,
  ticks,
  toX,
  toY,
  type Box,
  type Domain,
} from "../lib/spectral-notch/chart";
import {
  MINUS,
  formatDb,
  formatNumber,
  sweepAxisTitle,
  SWEEP_METRICS,
  type SweepMetric,
} from "../lib/spectral-notch/format";
import type { SpectralNotchLfmParsed } from "../lib/spectral-notch/schema";

type Doc = SpectralNotchLfmParsed;

const MARGIN = { left: 54, right: 24, top: 26, bottom: 42 } as const;

/** Real pixel width of the container, so chart text stays at its CSS size on every screen. */
function useWidth(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const update = () => setWidth(Math.max(240, Math.round(node.getBoundingClientRect().width)));
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

function plotBox(width: number, height: number): Box {
  return {
    x: MARGIN.left,
    y: MARGIN.top,
    w: width - MARGIN.left - MARGIN.right,
    h: height - MARGIN.top - MARGIN.bottom,
  };
}

interface FrameProps {
  height: number;
  label: string;
  caption: string;
  illustrativeLabel: string;
  children: (width: number, ids: { title: string; hatch: string }) => ReactNode;
  table?: ReactNode;
  className?: string;
  onMove?: (event: React.PointerEvent<SVGSVGElement>, width: number) => void;
  onLeave?: () => void;
}

/** Panel with a titled, labelled SVG, the illustrative label underneath, and a hidden numbers table. */
function ChartFrame({
  height,
  label,
  caption,
  illustrativeLabel,
  children,
  table,
  className,
  onMove,
  onLeave,
}: FrameProps) {
  const [ref, width] = useWidth();
  const uid = useId();
  const titleId = `${uid}-t`;
  return (
    <figure className={`notch-chart ${className ?? ""}`}>
      <div ref={ref}>
        <svg
          role="img"
          aria-labelledby={titleId}
          aria-label={label}
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          onPointerMove={onMove ? (event) => onMove(event, width) : undefined}
          onPointerLeave={onLeave}
        >
          <title id={titleId}>{label}</title>
          {children(width, { title: titleId, hatch: `${uid}-h` })}
        </svg>
      </div>
      <figcaption className="notch-caption">
        <span>{caption}</span>
        <span className="notch-illustrative">{illustrativeLabel}</span>
      </figcaption>
      {table ? <div className="sr-only">{table}</div> : null}
    </figure>
  );
}

function YGrid({
  box,
  domain,
  every,
  title,
  dp = 0,
}: {
  box: Box;
  domain: Domain;
  every: number;
  title: string;
  dp?: number;
}) {
  const marks = ticks(Math.ceil(domain[0] / every) * every, domain[1], every);
  return (
    <g>
      {marks.map((v) => {
        const y = toY(v, domain, box);
        return (
          <g key={v}>
            <line className="notch-grid" x1={box.x} x2={box.x + box.w} y1={y} y2={y} />
            <text className="notch-tick" x={box.x - 6} y={y + 3.5} textAnchor="end">
              {formatNumber(v, dp)}
            </text>
          </g>
        );
      })}
      <text
        className="notch-axis-title"
        transform={`translate(13 ${box.y + box.h / 2}) rotate(-90)`}
        textAnchor="middle"
      >
        {title}
      </text>
    </g>
  );
}

function XGrid({
  box,
  domain,
  marks,
  title,
  dp = 0,
}: {
  box: Box;
  domain: Domain;
  marks: number[];
  title: string;
  dp?: number;
}) {
  return (
    <g>
      {marks.map((v) => {
        const x = toX(v, domain, box);
        return (
          <g key={v}>
            <line className="notch-grid" x1={x} x2={x} y1={box.y} y2={box.y + box.h} />
            <text className="notch-tick" x={x} y={box.y + box.h + 15} textAnchor="middle">
              {formatNumber(v, dp)}
            </text>
          </g>
        );
      })}
      <text
        className="notch-axis-title"
        x={box.x + box.w / 2}
        y={box.y + box.h + 34}
        textAnchor="middle"
      >
        {title}
      </text>
      <rect className="notch-frame" x={box.x} y={box.y} width={box.w} height={box.h} />
    </g>
  );
}

/* ----------------------------------------------------------------------------------------- */
/* R5a Spectrum                                                                               */
/* ----------------------------------------------------------------------------------------- */

const SPECTRUM_Y: Domain = [-80, 5];

export function SpectrumChart({ doc }: { doc: Doc }) {
  const [hover, setHover] = useState<number | null>(null);
  const freqs = axisValues(doc.axes.frequency_mhz);
  const b = doc.params.waveform.bandwidth_mhz;
  const xDomain: Domain = [-b, b];
  const n = doc.params.notch;
  const half = n.width_mhz / 2 + n.taper_mhz;
  const hasNotch = n.depth_db > 0;
  const mask = doc.spectrum.mask_db;
  const idx = hover ?? -1;
  const onMove = (event: React.PointerEvent<SVGSVGElement>, width: number) => {
    const box = plotBox(width, 270);
    const rect = event.currentTarget.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * width;
    if (px < box.x || px > box.x + box.w) {
      setHover(null);
      return;
    }
    setHover(nearestIndex(freqs, fromX(px, xDomain, box)));
  };

  return (
    <ChartFrame
      height={270}
      label="Spectrum before and after a notch. Illustrative."
      caption="Spectrum"
      illustrativeLabel={doc.label}
      onMove={onMove}
      onLeave={() => setHover(null)}
      table={
        <table>
          <caption>Spectrum headline numbers. Illustrative.</caption>
          <tbody>
            <tr>
              <th scope="row">Notch center</th>
              <td>{formatNumber(n.center_mhz, 1)} MHz</td>
            </tr>
            <tr>
              <th scope="row">Notch footprint</th>
              <td>
                {formatNumber(n.center_mhz - half, 1)} to {formatNumber(n.center_mhz + half, 1)} MHz
              </td>
            </tr>
            <tr>
              <th scope="row">Mask minimum</th>
              <td>{formatDb(Math.min(...mask), 1)}</td>
            </tr>
            <tr>
              <th scope="row">Measured notch depth</th>
              <td>{formatDb(doc.metrics.notch.core_attenuation_db, 1)} in the flat bottom</td>
            </tr>
          </tbody>
        </table>
      }
    >
      {(width, ids) => {
        const box = plotBox(width, 270);
        const markers = ticks(-b, b, 10);
        const fl = Math.max(-b, n.center_mhz - half);
        const fr = Math.min(b, n.center_mhz + half);
        const zeroY = toY(0, SPECTRUM_Y, box);
        return (
          <g>
            <g>
              <defs>
                <pattern
                  id={ids.hatch}
                  width="6"
                  height="6"
                  patternUnits="userSpaceOnUse"
                  patternTransform="rotate(45)"
                >
                  <line x1="0" y1="0" x2="0" y2="6" className="notch-hatch" />
                </pattern>
              </defs>
              <rect x={0} y={0} width={width} height={270} fill="transparent" />
              <YGrid box={box} domain={SPECTRUM_Y} every={20} title="Level (dB)" />
              <XGrid
                box={box}
                domain={xDomain}
                marks={markers}
                title="Frequency offset (MHz, illustrative)"
              />
              {hasNotch && fr > fl ? (
                <g>
                  <rect
                    x={toX(fl, xDomain, box)}
                    y={box.y}
                    width={toX(fr, xDomain, box) - toX(fl, xDomain, box)}
                    height={box.h}
                    fill={`url(#${ids.hatch})`}
                    className="notch-footprint"
                  />
                  <path
                    className="notch-bracket"
                    d={`M${toX(fl, xDomain, box)} ${box.y + 7}v-5h${toX(fr, xDomain, box) - toX(fl, xDomain, box)}v5`}
                  />
                </g>
              ) : null}
              {[-b / 2, b / 2].map((edge) => (
                <g key={edge}>
                  <line
                    className="notch-edge"
                    x1={toX(edge, xDomain, box)}
                    x2={toX(edge, xDomain, box)}
                    y1={box.y}
                    y2={box.y + box.h}
                  />
                  <text
                    className="notch-tick notch-edge-label"
                    x={toX(edge, xDomain, box) + (edge < 0 ? 4 : -4)}
                    y={box.y + 12}
                    textAnchor={edge < 0 ? "start" : "end"}
                  >
                    {edge < 0 ? `${MINUS}B/2` : "+B/2"}
                  </text>
                </g>
              ))}
              <path
                className="notch-mask-fill"
                d={areaPath(freqs, mask, 0, xDomain, SPECTRUM_Y, box)}
              />
              <path
                className="notch-mask-line"
                d={polylinePath(freqs, mask, xDomain, SPECTRUM_Y, box)}
              />
              <path
                className="notch-line notch-line-muted"
                d={polylinePath(freqs, doc.spectrum.original_db, xDomain, SPECTRUM_Y, box)}
              />
              <path
                className="notch-line notch-line-accent"
                d={polylinePath(freqs, doc.spectrum.notched_db, xDomain, SPECTRUM_Y, box)}
              />
              <line className="notch-zero" x1={box.x} x2={box.x + box.w} y1={zeroY} y2={zeroY} />
              {idx >= 0 ? (
                <line
                  className="notch-cursor"
                  x1={toX(freqs[idx] ?? 0, xDomain, box)}
                  x2={toX(freqs[idx] ?? 0, xDomain, box)}
                  y1={box.y}
                  y2={box.y + box.h}
                />
              ) : null}
            </g>
            <Legend
              x={box.x}
              y={12}
              items={[
                { label: "original", cls: "notch-line-muted" },
                { label: "notched", cls: "notch-line-accent" },
                { label: "mask", cls: "notch-mask-line" },
              ]}
              hidden={idx >= 0}
            />
            {idx >= 0 ? (
              <text className="notch-readout" x={box.x} y={16}>
                f = {formatNumber(freqs[idx] ?? 0, 1)} MHz, original{" "}
                {formatDb(doc.spectrum.original_db[idx] ?? null, 1)}, notched{" "}
                {formatDb(doc.spectrum.notched_db[idx] ?? null, 1)}
              </text>
            ) : null}
          </g>
        );
      }}
    </ChartFrame>
  );
}

function Legend({
  x,
  y,
  items,
  hidden,
}: {
  x: number;
  y: number;
  items: { label: string; cls: string; dash?: boolean }[];
  hidden?: boolean;
}) {
  if (hidden) return null;
  let cursor = x;
  return (
    <g>
      {items.map((item) => {
        const start = cursor;
        cursor += 30 + item.label.length * 6.6 + 14;
        return (
          <g key={item.label}>
            <line
              className={`notch-line ${item.cls}`}
              x1={start}
              x2={start + 22}
              y1={y - 3.5}
              y2={y - 3.5}
            />
            <text className="notch-tick notch-legend" x={start + 27} y={y}>
              {item.label}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/* ----------------------------------------------------------------------------------------- */
/* R5b Compressed pulse                                                                       */
/* ----------------------------------------------------------------------------------------- */

export type DelayView = "3" | "0.5" | "0.25";
export type FilterKind = "original" | "notched";
const COMPRESSED_Y: Domain = [-70, 3];

export function CompressedChart({
  doc,
  kind,
  view,
}: {
  doc: Doc;
  kind: FilterKind;
  view: DelayView;
}) {
  const key = kind === "original" ? "replica_original" : "replica_notched";
  const metrics = doc.metrics[key];
  const caption =
    kind === "original" ? "Filter: original chirp (mismatched)" : "Filter: notched chirp (matched)";
  const zoom = doc.compressed_zoom;
  const full = axisValues(doc.axes.delay_us);
  let xs: number[] = full;
  let base: number[] = doc.compressed.baseline_db;
  let curve: number[] = doc.compressed[`${key}_db`];
  let half = 3;
  if (view === "0.5") {
    const [a, z] = cropIndices(full, 0.5);
    xs = full.slice(a, z + 1);
    base = base.slice(a, z + 1);
    curve = curve.slice(a, z + 1);
    half = 0.5;
  } else if (view === "0.25" && zoom) {
    xs = axisValues(zoom.delay_us);
    base = zoom.baseline_db;
    curve = zoom[`${key}_db`];
    half = 0.25;
  }
  const xDomain: Domain = [-half, half];
  const everyX = half === 3 ? 1 : half === 0.5 ? 0.25 : 0.125;
  const dpX = half === 3 ? 0 : half === 0.5 ? 2 : 3;
  // Sidelobe level in this chart's units (re. baseline peak): the curve's own peak sits at peak_loss_db.
  const pslLevel = metrics.peak_loss_db + metrics.psl_db;

  return (
    <ChartFrame
      height={270}
      className="notch-compressed"
      label="Compressed pulse for the original and the notched filter. Illustrative."
      caption={caption}
      illustrativeLabel={doc.label}
      table={
        <table>
          <caption>{caption}. Illustrative.</caption>
          <tbody>
            <tr>
              <th scope="row">Peak sidelobe level</th>
              <td>{formatDb(metrics.psl_db, 1)}</td>
            </tr>
            <tr>
              <th scope="row">Peak loss against baseline</th>
              <td>{formatDb(metrics.peak_loss_db, 1)}</td>
            </tr>
            <tr>
              <th scope="row">Mainlobe width at {MINUS}3 dB</th>
              <td>{metrics.mainlobe_width_3db_us.toFixed(4)} microseconds</td>
            </tr>
          </tbody>
        </table>
      }
    >
      {(width) => {
        const box = plotBox(width, 270);
        const pslY = toY(Math.max(COMPRESSED_Y[0], pslLevel), COMPRESSED_Y, box);
        const nullHalf = metrics.mainlobe_null_to_null_us / 2;
        return (
          <g>
            <YGrid
              box={box}
              domain={COMPRESSED_Y}
              every={10}
              title="Level (dB, re. baseline peak)"
            />
            <XGrid
              box={box}
              domain={xDomain}
              marks={ticks(-half, half, everyX)}
              title={"Delay (\u00b5s, illustrative)"}
              dp={dpX}
            />
            <path
              className="notch-line notch-line-muted"
              d={polylinePath(xs, base, xDomain, COMPRESSED_Y, box)}
            />
            <path
              className="notch-line notch-line-accent"
              d={polylinePath(xs, curve, xDomain, COMPRESSED_Y, box)}
            />
            <line className="notch-psl" x1={box.x} x2={box.x + box.w} y1={pslY} y2={pslY} />
            <text className="notch-psl-label" x={box.x + box.w - 4} y={pslY - 4} textAnchor="end">
              PSL {formatDb(metrics.psl_db, 1)}
            </text>
            {view === "0.25"
              ? [-nullHalf, nullHalf].map((v) => (
                  <line
                    key={v}
                    className="notch-null"
                    x1={toX(v, xDomain, box)}
                    x2={toX(v, xDomain, box)}
                    y1={box.y + box.h - 10}
                    y2={box.y + box.h}
                  />
                ))
              : null}
            <Legend
              x={box.x}
              y={12}
              items={[
                { label: "no notch", cls: "notch-line-muted" },
                { label: "notched", cls: "notch-line-accent" },
              ]}
            />
          </g>
        );
      }}
    </ChartFrame>
  );
}

/* ----------------------------------------------------------------------------------------- */
/* R5c Sweeps                                                                                 */
/* ----------------------------------------------------------------------------------------- */

export { SWEEP_METRICS, type SweepMetric };

const SWEEP_Y: Record<Exclude<SweepMetric, "mainlobe_width_3db_us">, Domain> = {
  psl_db: [-16, -4],
  islr_db: [-12, 0],
  peak_loss_db: [-6, 0],
};

interface SweepPoint {
  x: number;
  original: number;
  notched: number;
}

export function SweepChart({
  doc,
  xKey,
  metric,
  title,
  xLabel,
  xDomain,
  current,
}: {
  doc: Doc;
  xKey: "depth_db" | "width_mhz" | "taper_mhz";
  metric: SweepMetric;
  title: string;
  xLabel: string;
  xDomain: Domain;
  current: number;
}) {
  const sweeps = doc.sweeps;
  if (!sweeps) return null;
  const rows = sweeps[xKey] as unknown as Record<string, unknown>[];
  const points: SweepPoint[] = rows.map((row) => {
    const o = row.replica_original as Record<SweepMetric, number>;
    const nn = row.replica_notched as Record<SweepMetric, number>;
    return { x: row[xKey] as number, original: o[metric], notched: nn[metric] };
  });
  let yDomain: Domain;
  if (metric === "mainlobe_width_3db_us") {
    const values = points.flatMap((p) => [p.original, p.notched]);
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const pad = Math.max((hi - lo) * 0.15, 0.0002);
    yDomain = [lo - pad, hi + pad];
  } else {
    yDomain = SWEEP_Y[metric];
  }
  const dpY = metric === "mainlobe_width_3db_us" ? 4 : 0;
  const onGrid = points.some((p) => Math.abs(p.x - current) < 1e-9);
  const xs = points.map((p) => p.x);
  const metricLabel = SWEEP_METRICS.find((m) => m.id === metric)?.label ?? metric;
  const everyY =
    metric === "mainlobe_width_3db_us"
      ? (yDomain[1] - yDomain[0]) / 3
      : metric === "psl_db"
        ? 4
        : 2;

  return (
    <ChartFrame
      height={230}
      className="notch-sweep"
      label="Sidelobe and peak metrics against notch depth, width, and taper. Illustrative."
      caption={title}
      illustrativeLabel={doc.label}
      table={
        <table>
          <caption>
            {metricLabel} against {xLabel}. Illustrative.
          </caption>
          <thead>
            <tr>
              <th scope="col">{xLabel}</th>
              <th scope="col">Original filter</th>
              <th scope="col">Notched filter</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.x}>
                <th scope="row">{p.x}</th>
                <td>{formatNumber(p.original, dpY === 4 ? 4 : 3)}</td>
                <td>{formatNumber(p.notched, dpY === 4 ? 4 : 3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      {(width) => {
        const box = plotBox(width, 230);
        const yMarks = ticks(yDomain[0], yDomain[1], everyY);
        return (
          <g>
            <g>
              {yMarks.map((v) => {
                const y = toY(v, yDomain, box);
                return (
                  <g key={v}>
                    <line className="notch-grid" x1={box.x} x2={box.x + box.w} y1={y} y2={y} />
                    <text className="notch-tick" x={box.x - 6} y={y + 3.5} textAnchor="end">
                      {formatNumber(v, dpY)}
                    </text>
                  </g>
                );
              })}
            </g>
            <text
              className="notch-axis-title"
              transform={`translate(13 ${box.y + box.h / 2}) rotate(-90)`}
              textAnchor="middle"
            >
              {sweepAxisTitle(metric)}
            </text>
            <XGrid box={box} domain={xDomain} marks={xs} title={xLabel} />
            {onGrid ? (
              <line
                className="notch-marker"
                x1={toX(current, xDomain, box)}
                x2={toX(current, xDomain, box)}
                y1={box.y}
                y2={box.y + box.h}
              />
            ) : (
              <text className="notch-tick" x={box.x + box.w - 4} y={box.y + 12} textAnchor="end">
                Grid points only
              </text>
            )}
            <path
              className="notch-line notch-line-accent"
              d={polylinePath(
                xs,
                points.map((p) => p.original),
                xDomain,
                yDomain,
                box,
              )}
            />
            <path
              className="notch-line notch-line-accent notch-dashed"
              d={polylinePath(
                xs,
                points.map((p) => p.notched),
                xDomain,
                yDomain,
                box,
              )}
            />
            {points.map((p) => (
              <g key={p.x}>
                <circle
                  className="notch-dot"
                  cx={toX(p.x, xDomain, box)}
                  cy={toY(Math.min(yDomain[1], Math.max(yDomain[0], p.original)), yDomain, box)}
                  r={3}
                />
                <rect
                  className="notch-dot notch-dot-square"
                  x={toX(p.x, xDomain, box) - 3}
                  y={toY(Math.min(yDomain[1], Math.max(yDomain[0], p.notched)), yDomain, box) - 3}
                  width={6}
                  height={6}
                />
              </g>
            ))}
            <Legend
              x={box.x}
              y={12}
              items={[
                { label: "original", cls: "notch-line-accent" },
                { label: "notched", cls: "notch-line-accent notch-dashed" },
              ]}
            />
          </g>
        );
      }}
    </ChartFrame>
  );
}
