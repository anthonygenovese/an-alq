// SPDX-License-Identifier: MIT
"use client";

import { useRef, useState } from "react";
import { TRAINING_DISCLAIMER } from "@an-alq/emitters";
import {
  CompressedChart,
  SWEEP_METRICS,
  SpectrumChart,
  SweepChart,
  type DelayView,
  type FilterKind,
  type SweepMetric,
} from "./notch-charts";
import {
  MINUS,
  deltaChip,
  formatDb,
  formatDbMagnitude,
  formatMhz,
  formatNumber,
  formatPct,
  formatRatio,
  formatUs,
  notchDepthMagnitude,
} from "../lib/spectral-notch/format";
import {
  DEFAULT_PAYLOAD,
  DEFAULT_PRESET,
  PRESETS,
  loadPreset,
  type PresetId,
} from "../lib/spectral-notch/presets";
import { parseNotchPayload, type SpectralNotchLfmParsed } from "../lib/spectral-notch/schema";
import "./notch.css";

type Doc = SpectralNotchLfmParsed;

// Fixed text. The page never echoes a rejected value or field name (spec 7.2).
const COPY = {
  loading: "Opening the notch demo\u2026",
  refused: "This data is not marked illustrative, so it is not shown.",
  unsupported: "This data could not be read. The page and the data may be out of step.",
  network: "Could not load that preset. Try again.",
  noNotch: "No notch applied. This is the baseline.",
  eyebrow: "ILLUSTRATIVE \u00b7 SPECTRAL NOTCH",
  title: "Spectral notch on a chirp",
  lede: "Cut a slice out of a linear-FM pulse. Watch the compressed pulse change.",
} as const;

// TODO(geno): the two sentences after TRAINING_DISCLAIMER are Design Lead's proposal (spec section 8,
// "Page note (R2)"). Wording is undecided. "Names are fictional" in the shared sentence is slightly
// off for this page, which has no names. Keep, reword, or drop is Geno's call.
const NOTCH_NOTE_EXTRA =
  "Frequency and time here are normalized, illustrative units. Nothing on this page is a design for a real system.";

// TODO(geno): glossary entries for "notch", "mainlobe", "sidelobe", "PSL", "ISLR", "matched filter",
// "time-bandwidth product" are not written. The spec's metric tooltips (title text in the metrics
// table) are the only definitions on the page. Wording and placement are Geno's call. Do not add
// terms to the site glossary until then.

const DELAY_VIEWS: { id: DelayView; label: string }[] = [
  { id: "3", label: "\u00b13 \u00b5s" },
  { id: "0.5", label: "\u00b10.5 \u00b5s" },
  { id: "0.25", label: "\u00b10.25 \u00b5s" },
];

type Banner = null | "unsupported" | "network";
type View = { status: "ok"; id: PresetId; doc: Doc } | { status: "refused" };

function initialView(): View {
  const parsed = parseNotchPayload(DEFAULT_PAYLOAD);
  return parsed.status === "ok"
    ? { status: "ok", id: DEFAULT_PRESET, doc: parsed.doc }
    : { status: "refused" };
}

export function NotchScreen() {
  const [view, setView] = useState<View>(initialView);
  const [banner, setBanner] = useState<Banner>(null);
  const [pending, setPending] = useState<PresetId | null>(null);
  const [requested, setRequested] = useState<PresetId>(DEFAULT_PRESET);
  const [filter, setFilter] = useState<FilterKind>("original");
  const [delayView, setDelayView] = useState<DelayView>("3");
  const [metric, setMetric] = useState<SweepMetric>("psl_db");
  const ticket = useRef(0);

  const select = (id: PresetId) => {
    const mine = (ticket.current += 1);
    setRequested(id);
    setPending(id);
    setBanner(null);
    loadPreset(id).then(
      (raw) => {
        if (mine !== ticket.current) return; // a newer choice started: drop this result
        setPending(null);
        const parsed = parseNotchPayload(raw);
        if (parsed.status === "ok") setView({ status: "ok", id, doc: parsed.doc });
        else if (parsed.status === "refused") setView({ status: "refused" });
        else setBanner("unsupported");
      },
      () => {
        if (mine !== ticket.current) return;
        setPending(null);
        setBanner("network");
      },
    );
  };

  if (view.status === "refused") {
    return (
      <main className="notch">
        <p className="notch-refused" role="status">
          {COPY.refused}
        </p>
      </main>
    );
  }

  const { doc, id } = view;
  const hasZoom = Boolean(doc.compressed_zoom);
  const effectiveDelay: DelayView = delayView === "0.25" && !hasZoom ? "3" : delayView;
  const dim = pending !== null;

  return (
    <main className="notch">
      <header className="notch-top">
        <div>
          <p className="eyebrow">{COPY.eyebrow}</p>
          <h1>{COPY.title}</h1>
          <p className="notch-lede">{COPY.lede}</p>
        </div>
      </header>
      <p className="notch-note">
        {TRAINING_DISCLAIMER} {NOTCH_NOTE_EXTRA}
      </p>

      {banner ? (
        <p className="notch-banner" role="status">
          {banner === "network" ? COPY.network : COPY.unsupported}
          {banner === "network" ? (
            <button type="button" className="notch-retry" onClick={() => select(requested)}>
              Retry
            </button>
          ) : null}
        </p>
      ) : null}
      {pending ? (
        <p className="notch-loading" role="status">
          {COPY.loading}
        </p>
      ) : null}

      <div className={`notch-layout${dim ? " is-dim" : ""}`}>
        <div className="notch-col notch-left">
          <section
            className="notch-panel notch-controls-panel"
            aria-label="Controls"
            style={{ order: 1 }}
          >
            <h2>Preset</h2>
            <div className="controls notch-presets" role="group" aria-label="Preset">
              {PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={preset.id === id ? "is-on" : undefined}
                  aria-pressed={preset.id === id}
                  onClick={() => select(preset.id)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <ParamList doc={doc} />
            <Toggle
              label="Delay view"
              value={effectiveDelay}
              options={DELAY_VIEWS.filter((option) => option.id !== "0.25" || hasZoom)}
              onChange={setDelayView}
            />
            <Toggle
              className="notch-filter-toggle"
              label="Filter view"
              value={filter}
              options={[
                { id: "original", label: "Original filter" },
                { id: "notched", label: "Notched filter" },
              ]}
              onChange={setFilter}
            />
            {doc.sweeps ? (
              <Toggle
                label="Sweep metric"
                value={metric}
                options={SWEEP_METRICS.map((m) => ({ id: m.id, label: m.label }))}
                onChange={setMetric}
              />
            ) : null}
          </section>

          <section
            className="notch-panel notch-metrics-panel"
            aria-label="Metrics"
            style={{ order: 3 }}
          >
            <h2>Metrics</h2>
            <MetricsTable doc={doc} />
          </section>
        </div>

        <div className="notch-col notch-right">
          <section aria-label="Spectrum" style={{ order: 2 }}>
            <SpectrumChart doc={doc} />
          </section>
          <section aria-label="Compressed pulse" style={{ order: 4 }}>
            <div className="notch-pair" data-filter={filter}>
              <div className="notch-pair-original">
                <CompressedChart doc={doc} kind="original" view={effectiveDelay} />
              </div>
              <div className="notch-pair-notched">
                <CompressedChart doc={doc} kind="notched" view={effectiveDelay} />
              </div>
            </div>
          </section>
          {doc.sweeps ? (
            <section aria-label="Sweeps" style={{ order: 5 }}>
              <div className="notch-sweeps">
                <SweepChart
                  doc={doc}
                  xKey="depth_db"
                  metric={metric}
                  title="Against notch depth"
                  xLabel="Notch depth (dB)"
                  xDomain={[0, 60]}
                  current={doc.params.notch.depth_db}
                />
                <SweepChart
                  doc={doc}
                  xKey="width_mhz"
                  metric={metric}
                  title="Against notch width"
                  xLabel="Notch width (MHz)"
                  xDomain={[1, 12]}
                  current={doc.params.notch.width_mhz}
                />
                <SweepChart
                  doc={doc}
                  xKey="taper_mhz"
                  metric={metric}
                  title="Against edge taper"
                  xLabel="Edge taper (MHz)"
                  xDomain={[0, 4]}
                  current={doc.params.notch.taper_mhz}
                />
              </div>
            </section>
          ) : null}
        </div>
      </div>

      <p className="notch-footer">
        Synthetic {"\u00b7"} {doc.meta.backend} {"\u00b7"} {doc.meta.model_version} {"\u00b7"}{" "}
        schema {doc.schema_version}
      </p>
    </main>
  );
}

function Toggle<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: T;
  options: { id: T; label: string }[];
  onChange: (next: T) => void;
  className?: string;
}) {
  return (
    <div className={`notch-toggle ${className ?? ""}`}>
      <p className="notch-toggle-label">{label}</p>
      <div className="controls" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            className={option.id === value ? "is-on" : undefined}
            aria-pressed={option.id === value}
            onClick={() => onChange(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ParamList({ doc }: { doc: Doc }) {
  const { notch, waveform } = doc.params;
  const rows: [string, string][] = [
    ["Notch center", formatMhz(notch.center_mhz, 1)],
    ["Notch width (flat bottom)", formatMhz(notch.width_mhz, 1)],
    ["Notch depth", notch.depth_db === 0 ? "0 dB" : `${formatNumber(notch.depth_db, 0)} dB deep`],
    ["Edge taper (each side)", formatMhz(notch.taper_mhz, 1)],
    ["Amplitude window", waveform.amplitude_window],
    ["Bandwidth B", formatMhz(waveform.bandwidth_mhz, 0)],
    ["Pulse width T", formatUs(waveform.pulse_width_us, 1)],
    ["Sample rate", formatMhz(waveform.sample_rate_mhz, 0)],
  ];
  return (
    <dl className="notch-params">
      {rows.map(([name, value]) => (
        <div key={name}>
          <dt>{name}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Chip({ chip }: { chip: ReturnType<typeof deltaChip> }) {
  return (
    <span className={`notch-chip is-${chip.tone}`}>
      {chip.arrow ? <span aria-hidden="true">{chip.arrow} </span> : null}
      {chip.text}
    </span>
  );
}

function MetricsTable({ doc }: { doc: Doc }) {
  const { baseline, replica_original: orig, replica_notched: notched, notch } = doc.metrics;
  const columns = [
    { key: "baseline", head: "Baseline (no notch)", m: baseline },
    { key: "original", head: "Original filter", m: orig },
    { key: "notched", head: "Notched filter", m: notched },
  ] as const;
  const noNotch = doc.params.notch.depth_db === 0;
  const depthMag = notchDepthMagnitude(notch.inband_depth_db);

  return (
    <table className="notch-metrics">
      <thead>
        <tr>
          <th scope="col">
            <span className="sr-only">Metric</span>
          </th>
          {columns.map((c) => (
            <th key={c.key} scope="col">
              {c.head}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr>
          <th scope="row" title="Highest sidelobe against the main peak. Lower is better.">
            Peak sidelobe level <abbr>PSL</abbr>
          </th>
          {columns.map((c) => (
            <td key={c.key} data-label={c.head}>
              {formatDb(c.m.psl_db, 1)}
              {c.key !== "baseline" ? (
                <Chip chip={deltaChip(c.m.psl_db, baseline.psl_db, true)} />
              ) : null}
            </td>
          ))}
        </tr>
        <tr>
          <th scope="row" title="Sidelobe energy against mainlobe energy.">
            Integrated sidelobe ratio <abbr>ISLR</abbr>
          </th>
          {columns.map((c) => (
            <td key={c.key} data-label={c.head}>
              {formatDb(c.m.islr_db, 1)}
              {c.key !== "baseline" ? (
                <Chip chip={deltaChip(c.m.islr_db, baseline.islr_db, true)} />
              ) : null}
            </td>
          ))}
        </tr>
        <tr>
          <th scope="row">Mainlobe width ({MINUS}3 dB)</th>
          {columns.map((c) => (
            <td key={c.key} data-label={c.head}>
              {formatUs(c.m.mainlobe_width_3db_us, 4)}
              {c.key !== "baseline" ? (
                <span className="notch-chip is-neutral">
                  {formatRatio(c.m.mainlobe_width_3db_us, baseline.mainlobe_width_3db_us)}
                </span>
              ) : null}
            </td>
          ))}
        </tr>
        <tr>
          <th scope="row">Null-to-null width</th>
          {columns.map((c) => (
            <td key={c.key} data-label={c.head}>
              {formatUs(c.m.mainlobe_null_to_null_us, 3)}
            </td>
          ))}
        </tr>
        <tr>
          <th scope="row">Peak loss</th>
          {columns.map((c) => (
            <td key={c.key} data-label={c.head}>
              {c.key === "baseline" ? (
                formatDb(0, 1)
              ) : (
                <>
                  {formatDbMagnitude(c.m.peak_loss_db, 1)}
                  <span className="notch-sub"> below baseline</span>
                  <Chip chip={deltaChip(c.m.peak_loss_db, baseline.peak_loss_db, false)} />
                </>
              )}
            </td>
          ))}
        </tr>
        <tr className="notch-span-row">
          <th
            scope="row"
            title={`Core attenuation ${formatDb(notch.core_attenuation_db, 1)} in the flat bottom.`}
          >
            Notch depth (measured)
          </th>
          <td colSpan={3}>
            {noNotch ? (
              COPY.noNotch
            ) : (
              <>
                {formatDbMagnitude(notch.inband_depth_db, 1)}
                <span className="notch-sub">
                  {" "}
                  deep, core {formatDb(notch.core_attenuation_db, 1)}
                </span>
              </>
            )}
            {!noNotch && depthMag === 0 ? <span className="sr-only"> clamped to zero</span> : null}
          </td>
        </tr>
        <tr className="notch-span-row">
          <th scope="row">Band removed</th>
          <td colSpan={3}>{formatPct(notch.bandwidth_removed_pct, 1)}</td>
        </tr>
        <tr className="notch-span-row">
          <th scope="row">
            Time-bandwidth product <abbr>TBP</abbr>
          </th>
          <td colSpan={3}>{formatNumber(doc.params.waveform.time_bandwidth_product, 0)}</td>
        </tr>
      </tbody>
    </table>
  );
}
