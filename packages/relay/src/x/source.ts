import type { SignalSource } from "../source.js";
import type { RawPost } from "../types.js";
import { NIXLE_SEARCH_QUERY, XReader } from "./read.js";

/**
 * Public posts only. Sensitivity is low: no mailbox, no account profile,
 * no private geo. An optional location is one the operator typed.
 */
export class XSource implements SignalSource {
  readonly id = "x" as const;
  readonly sensitivity = "low" as const;
  readonly privateData = false;
  #sinceId: string | null = null;

  constructor(private readonly reader: XReader) {}

  async pull(signal?: AbortSignal): Promise<RawPost[]> {
    const posts = await this.reader.searchRecent(NIXLE_SEARCH_QUERY, {
      sinceId: this.#sinceId ?? undefined,
      maxResults: 10,
      signal,
    });
    return posts;
  }

  /** Test seam. The cursor is a post id kept only in this process. */
  noteCursor(id: string): void {
    this.#sinceId = id;
  }
}
