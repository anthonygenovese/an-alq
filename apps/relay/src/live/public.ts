import { DEFAULT_DECAY } from "../decay.js";
import { displaySummary } from "../normalize.js";
import { findBannedKey } from "../privacy.js";
import {
  DISCLAIMER,
  type Category,
  type LiveSignal,
  type Pulse,
  type ReceptionMark,
} from "../types.js";

export const SNAPSHOT_TTL_SECONDS = Math.floor(DEFAULT_DECAY.inactivityTtlMs / 1000);

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const PHONE = /(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]\d{4}\b/g;
const STREET =
  /\b\d{1,6}\s+(?:[A-Za-z0-9.'-]+\s+){0,4}(?:street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln|court|ct|way|parkway|pkwy)\b\.?/gi;
const HONORIFIC_NAME = /\b(?:mr|mrs|ms|miss|dr|sgt|officer)\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g;
const GIVEN_SURNAME = /\b[A-Z][a-z]{2,}\s+[A-Z][a-z]{2,}\b/g;
const KEPT_SECOND = new Set([
  "Department",
  "District",
  "County",
  "Police",
  "Fire",
  "Service",
  "Works",
  "Alert",
  "Road",
  "Street",
  "Avenue",
  "Highway",
  "City",
  "State",
  "Office",
]);

export type SnapshotStatus = "ok" | "empty" | "truncated" | "error" | "demo";

export interface PublicItem {
  summary: string;
  category: Category;
  agency: string | null;
  jurisdiction: string | null;
  firstSeen: string;
  lastSeen: string;
  sourceUrl: string | null;
  pulse: Pulse;
  receptions: number;
  receptionMark: ReceptionMark;
}

export interface SnapshotError {
  http_status: number;
  type: string;
  message: string;
}

export interface PublicSnapshot {
  generated_at: string;
  mode: "live" | "demo";
  demo: boolean;
  stale: boolean;
  status: SnapshotStatus;
  error: SnapshotError | null;
  disclaimer: string;
  stats: { liveSignals: number; relaysInWindow: number; windowMs: number };
  sources: [{ id: "x"; sensitivity: "low"; enabled: boolean; privateData: false }];
  items: PublicItem[];
}

function stripPersonalNames(input: string): string {
  return input.replace(HONORIFIC_NAME, " ").replace(GIVEN_SURNAME, (match) => {
    const second = match.split(/\s+/)[1] ?? "";
    return KEPT_SECOND.has(second) ? match : " ";
  });
}

/** Agency, category, source link, and a short line. Not the raw post. */
export function tightenSummary(input: string): string {
  const cleaned = stripPersonalNames(
    displaySummary(input).replace(EMAIL, " ").replace(PHONE, " ").replace(STREET, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, 160);
}

export function publicItem(signal: LiveSignal): PublicItem {
  return {
    summary: tightenSummary(signal.summary) || "Public alert",
    category: signal.category,
    agency: signal.agency,
    jurisdiction: signal.jurisdiction,
    firstSeen: signal.firstSeen,
    lastSeen: signal.lastSeen,
    sourceUrl: signal.sourceUrl,
    pulse: { periodMs: signal.pulse.periodMs, opacity: signal.pulse.opacity },
    receptions: signal.receptions,
    receptionMark: signal.receptionMark,
  };
}

export function demoSnapshot(now: number): PublicSnapshot {
  return {
    generated_at: new Date(now).toISOString(),
    mode: "demo",
    demo: true,
    stale: false,
    status: "demo",
    error: null,
    disclaimer: DISCLAIMER,
    stats: { liveSignals: 0, relaysInWindow: 0, windowMs: 30 * 60_000 },
    sources: [{ id: "x", sensitivity: "low", enabled: false, privateData: false }],
    items: [],
  };
}

export function liveSnapshot(input: {
  now: number;
  status: Exclude<SnapshotStatus, "demo">;
  stale: boolean;
  error: SnapshotError | null;
  items: PublicItem[];
  relaysInWindow: number;
  windowMs: number;
  generatedAt?: string;
}): PublicSnapshot {
  const snapshot: PublicSnapshot = {
    generated_at: input.generatedAt ?? new Date(input.now).toISOString(),
    mode: "live",
    demo: false,
    stale: input.stale,
    status: input.status,
    error: input.error,
    disclaimer: DISCLAIMER,
    stats: {
      liveSignals: input.items.length,
      relaysInWindow: input.relaysInWindow,
      windowMs: input.windowMs,
    },
    sources: [{ id: "x", sensitivity: "low", enabled: true, privateData: false }],
    items: input.items,
  };
  assertPublic(snapshot);
  return snapshot;
}

export function assertPublic(value: unknown): void {
  const found = findBannedKey(value);
  if (found) throw new Error("banned key");
}

/** Fixed text only. Never a URL, a header, or a token. */
export function snapshotError(httpStatus: number, type: string, message: string): SnapshotError {
  return {
    http_status: httpStatus,
    type: type.length > 80 ? "unknown" : type,
    message: message
      .replace(/https?:\/\/\S+/gi, "")
      .replace(/bearer\s+\S+/gi, "")
      .trim()
      .slice(0, 120),
  };
}
