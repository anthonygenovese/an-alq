import type { Signal, SignalSource } from "../source.js";
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

  constructor(
    private readonly reader: XReader,
    maxResults = 10,
  ) {
    void maxResults;
  }

  fetch(signal?: AbortSignal): Promise<RawPost[]> {
    return this.pull(signal);
  }

  normalize(post: RawPost): Signal | null {
    void post;
    return null;
  }

  async pull(signal?: AbortSignal): Promise<RawPost[]> {
    void signal;
    return [];
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
