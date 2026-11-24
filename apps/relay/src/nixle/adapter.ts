import type { Geocoder, RawPost } from "../types.js";
import { extractNixle } from "../nixle.js";
import { parsePost } from "../parse.js";
import type { Signal, SignalSource } from "../source.js";
import { hostAllowed, hostsForSource, NIXLE_HOSTS, NIXLE_SOURCE_ID } from "../sources/allow.js";
import { NIXLE_SEARCH_QUERY } from "../x/read.js";
import type { XSource } from "../x/source.js";

export const nixleSearchQuery = NIXLE_SEARCH_QUERY;

export function nixleAllowlist(): readonly string[] {
  return hostsForSource(NIXLE_SOURCE_ID);
}

/** Nixle link parser. Callers that are not this adapter do not use it. */
export function nixleRef(
  text: string,
  urls: readonly string[],
): { url: string; key: string } | null {
  return extractNixle(text, urls);
}

export function refForSource(
  sourceId: string,
): (text: string, urls: readonly string[]) => { url: string; key: string } | null {
  if (sourceId === NIXLE_SOURCE_ID) return nixleRef;
  return () => null;
}

/** Nixle posts from the existing read-only search. Selected only when the source id matches. */
export class NixleSource implements SignalSource {
  readonly id = NIXLE_SOURCE_ID;
  readonly sensitivity = "low" as const;
  readonly privateData = false;

  constructor(
    private readonly posts: XSource,
    private readonly geocoder: Geocoder,
  ) {}

  async pull(signal?: AbortSignal): Promise<RawPost[]> {
    const report = await this.pullContract(nixleSearchQuery, { maxResults: 10, signal });
    return report.posts;
  }

  fetch(signal?: AbortSignal): Promise<RawPost[]> {
    return this.pull(signal);
  }

  pullContract(
    query: string,
    opts: {
      sinceId?: string;
      startTime?: string;
      maxResults: number;
      signal?: AbortSignal;
      timeoutMs?: number;
    },
  ): ReturnType<XSource["pullContract"]> {
    if (query !== nixleSearchQuery) {
      return Promise.resolve({
        outcome: "empty",
        httpStatus: null,
        posts: [],
        returned: 0,
        newestId: null,
        problemType: null,
        cursorWritable: false,
        partialErrors: [],
      });
    }
    return this.posts.pullContract(query, opts);
  }

  normalize(post: RawPost): Signal | null {
    const candidate = parsePost(post, this.geocoder, nixleRef);
    if (!candidate?.sourceUrl || !candidate.sourceKey) return null;
    if (!hostAllowed(candidate.sourceUrl, NIXLE_HOSTS)) return null;
    return {
      sourceId: this.id,
      sourceKey: candidate.sourceKey,
      sourceUrl: candidate.sourceUrl,
      summary: candidate.summary,
      category: candidate.category,
      agency: candidate.agency,
    };
  }
}
