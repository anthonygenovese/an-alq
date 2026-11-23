import { CATEGORIES, type Category, type GeoPoint, type Precision } from "./types.js";
import type { AlertExtract } from "./extract.js";

const ALLOWED = new Set([
  "summary",
  "category",
  "agency",
  "jurisdiction",
  "observedAt",
  "nixleUrl",
  "nixleKey",
  "location",
]);

const LOCATION_KEYS = new Set(["lat", "lon", "precision", "label"]);
const PRECISIONS = new Set<Precision>(["intersection", "centroid"]);
const CATEGORY_SET = new Set<string>(CATEGORIES);

const SECRET = /bearer\s+|ya29\.|access_token|refresh_token|authorization/i;

/** Bound for the linear mailbox scan. Longer input is refused. */
export const MAX_EMAIL_SCAN = 4_096;

export type IngestResult = { ok: true; extract: AlertExtract } | { ok: false; reason: "rejected" };

/** Strict anonymous body. Any identity, header, or token field is rejected. */
export function parseIngestBody(value: unknown): IngestResult {
  if (!isRecord(value)) return { ok: false, reason: "rejected" };
  for (const key of Object.keys(value)) {
    if (!ALLOWED.has(key)) return { ok: false, reason: "rejected" };
  }
  const summary = stringField(value.summary, 240);
  const category = value.category;
  const observedAt = stringField(value.observedAt, 40);
  if (!summary || !observedAt || typeof category !== "string" || !CATEGORY_SET.has(category)) {
    return { ok: false, reason: "rejected" };
  }
  if (!Number.isFinite(Date.parse(observedAt))) return { ok: false, reason: "rejected" };
  if (hasSecret(summary) || containsEmail(summary)) return { ok: false, reason: "rejected" };
  const agency = optionalString(value.agency, 80);
  const jurisdiction = optionalString(value.jurisdiction, 80);
  const nixleUrl = optionalString(value.nixleUrl, 200);
  const nixleKey = optionalString(value.nixleKey, 80);
  if (
    agency === undefined ||
    jurisdiction === undefined ||
    nixleUrl === undefined ||
    nixleKey === undefined
  ) {
    return { ok: false, reason: "rejected" };
  }
  if (nixleUrl && !/^https:\/\/([a-z0-9.-]+\.)?nixle\.(us|com)\//i.test(nixleUrl)) {
    return { ok: false, reason: "rejected" };
  }
  const location = readLocation(value.location);
  if (location === undefined) return { ok: false, reason: "rejected" };
  const extract: AlertExtract = {
    summary,
    category: category as Category,
    agency,
    jurisdiction,
    observedAt: new Date(Date.parse(observedAt)).toISOString(),
    nixleUrl,
    nixleKey,
    location,
  };
  if (containsSecret(extract)) return { ok: false, reason: "rejected" };
  return { ok: true, extract };
}

export function ingestRequest(extract: AlertExtract): {
  url: "/api/ingest";
  method: "POST";
  headers: { "content-type": "application/json" };
  body: string;
} {
  const clean = parseIngestBody(extract);
  if (!clean.ok) throw new Error("ingest rejected");
  return {
    url: "/api/ingest",
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(clean.extract),
  };
}

function containsSecret(extract: AlertExtract): boolean {
  const blob = JSON.stringify(extract);
  if (blob.length > MAX_EMAIL_SCAN) return true;
  return hasSecret(blob) || containsEmail(blob);
}

function hasSecret(value: string): boolean {
  if (value.length > MAX_EMAIL_SCAN) return true;
  return SECRET.test(value);
}

/**
 * Mailbox shape, one forward pass. No nested quantifiers.
 * Over-long input is refused instead of scanned.
 */
export function containsEmail(value: string): boolean {
  if (value.length > MAX_EMAIL_SCAN) return true;
  const text = value.toLowerCase();
  let index = 0;
  let local = 0;
  while (index < text.length) {
    const code = text.charCodeAt(index);
    if (isLocal(code)) {
      local += 1;
      index += 1;
      continue;
    }
    if (code === 64 && local > 0) {
      const domain = readDomain(text, index + 1);
      if (domain.ok) return true;
      local = 0;
      index = domain.next;
      continue;
    }
    local = 0;
    index += 1;
  }
  return false;
}

function readDomain(text: string, start: number): { ok: boolean; next: number } {
  let index = start;
  let label = 0;
  let sawDot = false;
  let tld = 0;
  let tldLetters = true;
  while (index < text.length) {
    const code = text.charCodeAt(index);
    if (code === 46) {
      if (label === 0) return { ok: false, next: index };
      sawDot = true;
      label = 0;
      tld = 0;
      tldLetters = true;
      index += 1;
      continue;
    }
    if (isLabel(code)) {
      label += 1;
      if (code >= 97 && code <= 122) tld += 1;
      else tldLetters = false;
      index += 1;
      continue;
    }
    break;
  }
  return { ok: sawDot && tldLetters && tld >= 2, next: index };
}

function isLocal(code: number): boolean {
  return isLabel(code) || code === 46 || code === 95 || code === 37 || code === 43;
}

function isLabel(code: number): boolean {
  return (code >= 97 && code <= 122) || (code >= 48 && code <= 57) || code === 45;
}

function readLocation(value: unknown): GeoPoint | null | undefined {
  if (value === null) return null;
  if (!isRecord(value)) return undefined;
  for (const key of Object.keys(value)) {
    if (!LOCATION_KEYS.has(key)) return undefined;
  }
  const { lat, lon, precision, label } = value;
  if (
    typeof lat !== "number" ||
    typeof lon !== "number" ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lon)
  )
    return undefined;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return undefined;
  if (typeof precision !== "string" || !PRECISIONS.has(precision as Precision)) return undefined;
  if (typeof label !== "string" || label.length > 80 || containsEmail(label) || hasSecret(label))
    return undefined;
  return { lat, lon, precision: precision as Precision, label };
}

function stringField(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) return null;
  return trimmed;
}

function optionalString(value: unknown, max: number): string | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (trimmed.length > max) return undefined;
  if (trimmed && (containsEmail(trimmed) || hasSecret(trimmed))) return undefined;
  return trimmed || null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
