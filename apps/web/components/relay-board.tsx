"use client";

import { useEffect, useRef, useState } from "react";
import { buildContributionChart } from "@an-alq/relay/chart";
import { DemoClock, DemoSimulator, SPEED_STEPS, isSpeedStep } from "@an-alq/relay";
import {
  CATEGORY_LABEL,
  DISCLAIMER,
  type Category,
  type LiveSnapshot,
  type Pulse,
} from "@an-alq/relay/types";

interface LiveCard {
  summary: string;
  category: Category;
  agency: string | null;
  pulse: Pulse;
  sourceUrl: string | null;
}

export function RelayBoard() {
  const demoRef = useRef<DemoSimulator | null>(null);
  const clockRef = useRef<DemoClock | null>(null);
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null);
  const [live, setLive] = useState<LiveCard[] | null>(null);
  const [liveNote, setLiveNote] = useState<string | null>(null);
  const [allowedHosts, setAllowedHosts] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch("/api/relay/snapshot");
        if (!response.ok) return;
        const body = (await response.json()) as {
          mode?: string;
          demo?: boolean;
          stale?: boolean;
          source?: string;
          notice?: string | null;
          allowedHosts?: string[];
          disclaimer?: string;
          items?: LiveCard[];
        };
        if (cancelled) return;
        setAllowedHosts(Array.isArray(body.allowedHosts) ? body.allowedHosts : []);
        if (body.source === "none" || body.notice === "No live source configured") {
          setLive(null);
          setLiveNote("No live source configured");
          return;
        }
        const items = Array.isArray(body.items) ? body.items : [];
        if (
          body.mode === "live" &&
          body.demo === false &&
          body.stale === false &&
          items.length > 0
        ) {
          setLive(items);
          setLiveNote(null);
          return;
        }
        setLive(null);
        setLiveNote(
          body.stale
            ? "Demo fixtures. The last public snapshot is stale."
            : "Demo fixtures. A live snapshot is not available.",
        );
      } catch {
        if (!cancelled) {
          setLive(null);
          setLiveNote("Demo fixtures. A live snapshot is not available.");
        }
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const demo = new DemoSimulator();
    const clock = new DemoClock(performance.now());
    demoRef.current = demo;
    clockRef.current = clock;
    const publish = () => {
      const elapsed = clock.now(performance.now());
      demo.advanceTo(elapsed);
      setSnapshot(demo.snapshot(elapsed, clock.speed));
    };
    publish();
    const timer = window.setInterval(publish, 200);
    return () => window.clearInterval(timer);
  }, []);

  const setSpeed = (speed: number) => {
    const demo = demoRef.current;
    const clock = clockRef.current;
    if (!demo || !clock || !isSpeedStep(speed)) return;
    clock.setSpeed(speed, performance.now());
    const elapsed = clock.now(performance.now());
    setSnapshot(demo.snapshot(elapsed, clock.speed));
  };

  const reset = () => {
    const demo = demoRef.current;
    const clock = clockRef.current;
    if (!demo || !clock) return;
    clock.reset(performance.now());
    demo.reset();
    setSnapshot(demo.snapshot(0, clock.speed));
  };

  const chart = snapshot ? buildContributionChart(snapshot.contribution.nodes) : null;

  return (
    <section className="relay" aria-label="Relay board">
      <div className="relay-top">
        <div>
          <p className="eyebrow">Public alerts</p>
          <h1>Relay</h1>
        </div>
        <p className="demo-flag">{live ? "Live, public X reads" : "Demo · fixtures only"}</p>
      </div>
      <p className="relay-note" role="note">
        {DISCLAIMER} It does not read a mailbox and it does not post.
        {liveNote ? ` ${liveNote}` : ""}
      </p>
      {live ? null : (
        <div className="controls" role="group" aria-label="Demo speed">
          {SPEED_STEPS.map((speed) => (
            <button
              key={speed}
              type="button"
              className={snapshot?.speed === speed ? "is-on" : ""}
              onClick={() => setSpeed(speed)}
            >
              {speed}×
            </button>
          ))}
          <button type="button" onClick={reset}>
            Reset
          </button>
        </div>
      )}
      <div className="relay-layout">
        <div className="relay-chart">
          {live ? (
            <p className="page-fallback">Public Nixle alerts from the latest read.</p>
          ) : chart ? (
            <svg viewBox="-160 -160 320 320" role="img" aria-label="Contribution chart">
              <circle className="stroke" r={chart.tickRing} />
              {chart.rings.map((radius) => (
                <circle key={radius} className="stroke faint" r={radius} />
              ))}
              {chart.ticks.map((tick) => (
                <line
                  key={`${tick.x1}:${tick.y1}:${tick.x2}`}
                  className={tick.major ? "stroke" : "stroke faint"}
                  x1={tick.x1}
                  y1={tick.y1}
                  x2={tick.x2}
                  y2={tick.y2}
                />
              ))}
              {chart.lines.map((line) => (
                <line
                  key={`${line.x1}:${line.y1}:${line.x2}:${line.y2}`}
                  className="stroke"
                  x1={line.x1}
                  y1={line.y1}
                  x2={line.x2}
                  y2={line.y2}
                  opacity={line.opacity}
                />
              ))}
              {chart.points.map((point) => (
                <circle
                  key={`${point.sector}:${point.ring}:${point.x}`}
                  className="lit-node"
                  cx={point.x}
                  cy={point.y}
                  r="3.5"
                  opacity={Math.max(0.35, point.opacity)}
                />
              ))}
            </svg>
          ) : (
            <p className="page-fallback">Opening the demo…</p>
          )}
        </div>
        <ol className="signal-list">
          {live && live.length === 0 ? (
            <li className="empty-signals">No signals in the window yet.</li>
          ) : null}
          {live?.map((signal) => (
            <li key={`${signal.sourceUrl ?? signal.summary}`}>
              <div className="signal-kicker">
                <span>{CATEGORY_LABEL[signal.category]}</span>
                <span>
                  <span
                    className="pulse"
                    style={{ opacity: signal.pulse.opacity }}
                    aria-hidden="true"
                  />
                </span>
              </div>
              {allowedLink(signal.sourceUrl, allowedHosts) ? (
                <p>
                  <a href={allowedLink(signal.sourceUrl, allowedHosts) ?? undefined}>
                    {signal.summary}
                  </a>
                </p>
              ) : (
                <p>{signal.summary}</p>
              )}
              {signal.agency ? <p className="empty-signals">{signal.agency}</p> : null}
            </li>
          ))}
          {!live && snapshot && snapshot.signals.length === 0 ? (
            <li className="empty-signals">No signals in the window yet.</li>
          ) : null}
          {!live &&
            snapshot?.signals.map((signal) => (
              <li key={signal.id}>
                <div className="signal-kicker">
                  <span>{CATEGORY_LABEL[signal.category]}</span>
                  <span>
                    <span
                      className="pulse"
                      style={{ opacity: signal.pulse.opacity }}
                      aria-hidden="true"
                    />{" "}
                    {signal.receptions} receptions
                  </span>
                </div>
                <p>{signal.summary}</p>
                {signal.agency ? (
                  <p className="empty-signals">
                    {signal.agency}
                    {signal.jurisdiction ? ` · ${signal.jurisdiction}` : ""}
                  </p>
                ) : null}
              </li>
            ))}
        </ol>
      </div>
    </section>
  );
}

function allowedLink(url: string | null, hosts: readonly string[]): string | null {
  if (!url || hosts.length === 0) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
    const host = parsed.hostname.toLowerCase();
    const listed = hosts.some(
      (allowed) => host === allowed || host.endsWith(`.${allowed.toLowerCase()}`),
    );
    return listed ? parsed.toString() : null;
  } catch {
    return null;
  }
}
