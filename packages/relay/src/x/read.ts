import { XRateLimiter, type HeaderBag } from "./limit.js";

/** The only X endpoints this module calls. Both are reads. */
export const X_READ_PATHS = {
  recent: "/2/tweets/search/recent",
  stream: "/2/tweets/search/stream",
} as const;

export const NIXLE_SEARCH_QUERY =
  "(url:nixle.us OR url:local.nixle.com OR url:nixle.com) -is:retweet";

export interface ReadPost {
  text: string;
  createdAt: number;
  urls: string[];
  accountMaterial: string | null;
  postMaterial: string;
}

export class XReadError extends Error {
  constructor(readonly status: number) {
    super(`x read failed: ${status}`);
    this.name = "XReadError";
  }
}

interface TweetPayload {
  id?: string;
  text?: string;
  created_at?: string;
  author_id?: string;
  entities?: { urls?: { expanded_url?: string; url?: string }[] };
}

interface SearchPayload {
  data?: TweetPayload[];
}

export interface XReaderOptions {
  bearerToken: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  limiter: XRateLimiter;
  now?: () => number;
}

/**
 * Read-only X API v2 client. Recent search and the filtered stream are the
 * only calls. There is no method that creates a post, a like, or a rule.
 */
export class XReader {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;

  constructor(private readonly options: XReaderOptions) {
    this.baseUrl = (options.baseUrl ?? "https://api.x.com").replace(/\/$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? Date.now;
  }

  async searchRecent(
    query: string,
    opts: { sinceId?: string; maxResults?: number; signal?: AbortSignal } = {},
  ): Promise<ReadPost[]> {
    const url = new URL(this.baseUrl + X_READ_PATHS.recent);
    url.searchParams.set("query", query);
    url.searchParams.set("max_results", String(clampResults(opts.maxResults ?? 10)));
    url.searchParams.set("tweet.fields", "created_at,entities,author_id");
    if (opts.sinceId) url.searchParams.set("since_id", opts.sinceId);
    const response = await this.get(url, opts.signal);
    const payload = (await response.json()) as SearchPayload;
    return (payload.data ?? []).flatMap((tweet) => {
      const post = toReadPost(tweet);
      return post ? [post] : [];
    });
  }

  /**
   * Opens the filtered stream. Stream rules are not created or deleted here.
   */
  async openStream(signal: AbortSignal): Promise<Response> {
    const url = new URL(this.baseUrl + X_READ_PATHS.stream);
    url.searchParams.set("tweet.fields", "created_at,entities,author_id");
    return this.get(url, signal);
  }

  private async get(url: URL, signal?: AbortSignal): Promise<Response> {
    const wait = this.options.limiter.delayMs(this.now());
    if (wait > 0) await delay(wait, signal);
    this.options.limiter.markSent(this.now());
    const response = await this.fetchImpl(url, {
      method: "GET",
      headers: {
        authorization: `Bearer ${this.options.bearerToken}`,
        accept: "application/json",
      },
      signal,
    });
    this.options.limiter.update(response.headers as HeaderBag, this.now());
    if (!response.ok) throw new XReadError(response.status);
    return response;
  }
}

export function postsFromStreamLine(line: string): ReadPost | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  let payload: unknown;
  try {
    payload = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (!payload || typeof payload !== "object" || !("data" in payload)) return null;
  const data = (payload as { data?: TweetPayload }).data;
  if (!data) return null;
  return toReadPost(data);
}

function toReadPost(tweet: TweetPayload): ReadPost | null {
  if (!tweet.id || !tweet.text || !tweet.created_at) return null;
  const createdAt = Date.parse(tweet.created_at);
  if (!Number.isFinite(createdAt)) return null;
  const urls = (tweet.entities?.urls ?? [])
    .map((entry) => entry.expanded_url || entry.url)
    .filter((url): url is string => typeof url === "string" && url.length > 0);
  return {
    text: tweet.text,
    createdAt,
    urls,
    accountMaterial: tweet.author_id ?? null,
    postMaterial: tweet.id,
  };
}

function clampResults(value: number): number {
  if (!Number.isFinite(value)) return 10;
  return Math.min(100, Math.max(10, Math.round(value)));
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("aborted", "AbortError"));
      },
      { once: true },
    );
  });
}
