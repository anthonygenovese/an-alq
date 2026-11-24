import type { Geocoder } from "../types.js";
import type { RawPost } from "../types.js";
import { parsePost } from "../parse.js";
import type { Signal, SignalSource } from "../source.js";
import { hostAllowed, NIXLE_HOSTS, NIXLE_SOURCE_ID } from "../sources/allow.js";
import type { XSource } from "../x/source.js";

/** Nixle posts from the existing read-only search. Selected only when the source id matches. */
export class NixleSource implements SignalSource {
  readonly id = NIXLE_SOURCE_ID;
  readonly sensitivity = "low" as const;
  readonly privateData = false;

  constructor(
    private readonly posts: XSource,
    private readonly geocoder: Geocoder,
  ) {}

  pull(signal?: AbortSignal): Promise<RawPost[]> {
    return this.posts.pull(signal);
  }

  fetch(signal?: AbortSignal): Promise<RawPost[]> {
    return this.pull(signal);
  }

  pullContract(opts: Parameters<XSource["pullContract"]>[0]): ReturnType<XSource["pullContract"]> {
    return this.posts.pullContract(opts);
  }

  normalize(post: RawPost): Signal | null {
    const candidate = parsePost(post, this.geocoder);
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
