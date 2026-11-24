import { searchQueryForSource } from "../live/sources.js";
import type { SignalSource } from "../source.js";
import type { RawPost } from "../types.js";
import { XReader, type RecentSearchReport } from "./read.js";

/**
 * Public posts only. Sensitivity is low: no mailbox, no account profile,
 * no private geo. An optional location is one the operator typed.
 */
export class XSource implements SignalSource {
  readonly id = "x" as const;
  readonly sensitivity = "low" as const;
  readonly privateData = false;
  #sinceId: string | null = null;
  #maxResults: number;

  constructor(
    private readonly reader: XReader,
    maxResults = 10,
  ) {
    this.#maxResults = maxResults;
  }

  async pull(signal?: AbortSignal): Promise<RawPost[]> {
    const query = searchQueryForSource(this.id);
    if (!query) return [];
    return this.reader.searchRecent(query, {
      sinceId: this.#sinceId ?? undefined,
      maxResults: this.#maxResults,
      signal,
    });
  }

  /** Test seam. The cursor is a post id kept only in this process. */
  noteCursor(id: string): void {
    this.#sinceId = id;
  }

  /**
   * One cron tick. Cold start passes `startTime` and no `sinceId`.
   * Steady state passes `sinceId` only. The Redis cursor outlives this object.
   */
  pullContract(
    query: string,
    opts: {
      sinceId?: string;
      startTime?: string;
      maxResults: number;
      signal?: AbortSignal;
      timeoutMs?: number;
    },
  ): Promise<RecentSearchReport> {
    return this.reader.searchRecentReport(query, { ...opts, maxPages: 3 });
  }
}
