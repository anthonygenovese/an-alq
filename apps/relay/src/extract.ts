// SPDX-License-Identifier: MIT
import { nixleRef } from "./nixle/adapter.js";
import { parsePost } from "./parse.js";
import type { Category, Geocoder, GeoPoint, RawPost } from "./types.js";

/** Fields the browser may send. No token, no address, no message id. */
export interface AlertExtract {
  summary: string;
  category: Category;
  agency: string | null;
  jurisdiction: string | null;
  observedAt: string;
  sourceUrl: string | null;
  sourceKey: string | null;
  location: GeoPoint | null;
}

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

export function stripAddresses(text: string): string {
  return text.replace(EMAIL, " ");
}

export function extractFromPost(post: RawPost, geocoder: Geocoder): AlertExtract | null {
  const parsed = parsePost(
    {
      ...post,
      text: stripAddresses(post.text),
      accountMaterial: null,
    },
    geocoder,
    nixleRef,
  );
  if (!parsed) return null;
  return {
    summary: parsed.summary,
    category: parsed.category,
    agency: parsed.agency,
    jurisdiction: parsed.jurisdiction,
    observedAt: new Date(parsed.createdAt).toISOString(),
    sourceUrl: parsed.sourceUrl,
    sourceKey: parsed.sourceKey,
    location: parsed.location,
  };
}

export function postFromExtract(extract: AlertExtract): RawPost {
  const url = extract.sourceUrl ?? "";
  return {
    text: url ? `${extract.summary}\n${url}` : extract.summary,
    createdAt: Date.parse(extract.observedAt),
    urls: url ? [url] : [],
    accountMaterial: null,
    postMaterial: `extract|${extract.sourceKey ?? extract.summary}|${extract.observedAt}`,
  };
}
