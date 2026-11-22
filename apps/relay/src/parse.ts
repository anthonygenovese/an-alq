import { classify } from "./classify.js";
import { locateAgency, parseIntersection } from "./geo.js";
import { matchAgency } from "./gazetteer.js";
import { extractNixle } from "./nixle.js";
import { displaySummary, normalizeAlertText } from "./normalize.js";
import type { Candidate, Geocoder, RawPost } from "./types.js";

const MAX_TEXT = 2_000;

export function parsePost(post: RawPost, geocoder: Geocoder): Candidate | null {
  if (!Number.isFinite(post.createdAt)) return null;
  const text = post.text.slice(0, MAX_TEXT);
  const nixle = extractNixle(text, post.urls);
  const normalizedText = normalizeAlertText(text);
  const agency = matchAgency(normalizedText);
  const category = classify(normalizedText);
  const alert = nixle !== null || (agency !== null && category !== "other");
  if (!alert) return null;
  let summary = displaySummary(text);
  if (!summary && nixle) summary = "Nixle alert";
  if (!summary) return null;
  const intersection = parseIntersection(normalizedText);
  const location = locateAgency(agency, intersection, geocoder);
  return {
    normalizedText,
    summary,
    category,
    nixleKey: nixle?.key ?? null,
    nixleUrl: nixle?.url ?? null,
    agency: agency?.name ?? null,
    jurisdiction: agency?.jurisdiction ?? null,
    location,
    createdAt: post.createdAt,
    accountMaterial: post.accountMaterial,
    postMaterial: post.postMaterial,
  };
}
