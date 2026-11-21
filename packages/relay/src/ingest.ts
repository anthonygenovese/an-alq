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
const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;

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
  if (SECRET.test(summary) || EMAIL.test(summary)) return { ok: false, reason: "rejected" };
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
  return SECRET.test(blob) || EMAIL.test(blob);
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
  if (typeof label !== "string" || label.length > 80 || EMAIL.test(label) || SECRET.test(label))
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
  if (trimmed && (EMAIL.test(trimmed) || SECRET.test(trimmed))) return undefined;
  return trimmed || null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
