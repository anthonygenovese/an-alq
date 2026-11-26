// SPDX-License-Identifier: MIT
import { XRateLimiter, type HeaderBag } from "./limit.js";

/** The only X endpoints this module calls. Both are reads. */
export const X_READ_PATHS = {
  recent: "/2/tweets/search/recent",
  stream: "/2/tweets/search/stream",
} as const;

export const NIXLE_SEARCH_QUERY =
  "(url:nixle.us OR url:local.nixle.com OR url:nixle.com) -is:retweet";

/** Official OpenAPI spec 2.175 names this `post.fields`. Keep `tweet.fields` until preview shows `author_id` without expansions. */
export const TWEET_FIELDS = "created_at,entities,author_id";

const MAX_PAGES = 3;
const MAX_BACKOFF_MS = 8_000;
const SERVER_BACKOFF_MS = 400;
const DEFAULT_TIMEOUT_MS = 9_000;
const USAGE_CAPPED = "https://api.x.com/2/problems/usage-capped";

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

export interface XReaderOptions {
  bearerToken: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  limiter: XRateLimiter;
  now?: () => number;
}

export interface RecentSearchRequest {
  sinceId?: string;
  startTime?: string;
  maxResults?: number;
  signal?: AbortSignal;
  maxPages?: number;
  timeoutMs?: number;
}

export type SearchOutcome =
  | "ok"
  | "empty"
  | "truncated"
  | "auth"
  | "rate"
  | "usage_capped"
  | "server"
  | "timeout"
  | "bad_since"
  | "error";

export interface RecentSearchReport {
  outcome: SearchOutcome;
  httpStatus: number | null;
  posts: ReadPost[];
  /** Posts present in completed 200 bodies, including ones later dropped as non-alerts. */
  returned: number;
  newestId: string | null;
  problemType: string | null;
  /** True only when newestId came from a fully read 200 body, or the body was an empty 200. */
  cursorWritable: boolean;
  partialErrors: { type: string }[];
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
    const report = await this.searchRecentReport(query, { ...opts, maxPages: 1 });
    if (report.outcome === "ok" || report.outcome === "empty" || report.outcome === "truncated") {
      return report.posts;
    }
    throw new XReadError(report.httpStatus ?? 0);
  }

  /**
   * Recent search with `sort_order=recency`. `since_id` and `start_time` are
   * never both sent. At most three pages; a leftover `next_token` is `truncated`.
   */
  async searchRecentReport(
    query: string,
    opts: RecentSearchRequest = {},
  ): Promise<RecentSearchReport> {
    if (opts.sinceId && opts.startTime) {
      return blank("error", null, "mutually_exclusive");
    }
    const maxPages = Math.min(MAX_PAGES, Math.max(1, Math.floor(opts.maxPages ?? 1)));
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const posts: ReadPost[] = [];
    const partialErrors: { type: string }[] = [];
    let returned = 0;
    let newestId: string | null = null;
    let nextToken: string | null = null;

    for (let page = 0; page < maxPages; page += 1) {
      const result = await this.readPage(query, opts, nextToken, timeoutMs);
      if (result.kind === "stop") {
        return {
          outcome: result.outcome,
          httpStatus: result.httpStatus,
          posts,
          returned,
          newestId,
          problemType: result.problemType,
          cursorWritable: false,
          partialErrors,
        };
      }
      posts.push(...result.posts);
      returned += result.returned;
      newestId = laterSnowflake(newestId, result.newestId);
      partialErrors.push(...result.errors);
      nextToken = result.nextToken;
      if (!nextToken) {
        return {
          outcome: posts.length === 0 ? "empty" : "ok",
          httpStatus: 200,
          posts,
          returned,
          newestId,
          problemType: null,
          cursorWritable: true,
          partialErrors,
        };
      }
      if (page === maxPages - 1) {
        return {
          outcome: "truncated",
          httpStatus: 200,
          posts,
          returned,
          newestId,
          problemType: null,
          cursorWritable: true,
          partialErrors,
        };
      }
    }
    return blank("error", null, "unknown");
  }

  /**
   * Opens the filtered stream. Stream rules are not created or deleted here.
   * The live poll does not call this.
   */
  async openStream(signal: AbortSignal): Promise<Response> {
    const url = new URL(this.baseUrl + X_READ_PATHS.stream);
    url.searchParams.set("tweet.fields", TWEET_FIELDS);
    return this.get(url, signal);
  }

  private async readPage(
    query: string,
    opts: RecentSearchRequest,
    nextToken: string | null,
    timeoutMs: number,
  ): Promise<
    | {
        kind: "page";
        posts: ReadPost[];
        returned: number;
        newestId: string | null;
        nextToken: string | null;
        errors: { type: string }[];
      }
    | {
        kind: "stop";
        outcome: SearchOutcome;
        httpStatus: number | null;
        problemType: string | null;
      }
  > {
    const pre = this.options.limiter.delayMs(this.now());
    if (pre > MAX_BACKOFF_MS) return stop("rate", 429, "rate_limit");
    if (pre > 0) {
      const waited = await waitFor(pre, opts.signal);
      if (!waited) return stop("timeout", null, "timeout");
    }
    let response = await this.request(query, opts, nextToken, timeoutMs);
    if (response === "timeout") return stop("timeout", null, "timeout");
    if (response === "network") return stop("error", null, "network");
    this.options.limiter.update(response.headers as HeaderBag, this.now());

    if (response.status === 429 && !usageCapped(await peek(response))) {
      const retry = retryDelayMs(response.headers as HeaderBag, this.now());
      if (retry <= MAX_BACKOFF_MS) {
        const waited = await waitFor(retry, opts.signal);
        if (!waited) return stop("timeout", 429, "timeout");
        response = await this.request(query, opts, nextToken, timeoutMs);
        if (response === "timeout") return stop("timeout", 429, "timeout");
        if (response === "network") return stop("error", null, "network");
        this.options.limiter.update(response.headers as HeaderBag, this.now());
      }
    } else if (response.status >= 500) {
      const failedStatus = response.status;
      const waited = await waitFor(SERVER_BACKOFF_MS, opts.signal);
      if (!waited) return stop("timeout", failedStatus, "timeout");
      response = await this.request(query, opts, nextToken, timeoutMs);
      if (response === "timeout") return stop("timeout", failedStatus, "timeout");
      if (response === "network") return stop("error", null, "network");
      this.options.limiter.update(response.headers as HeaderBag, this.now());
    }

    return classify(response, Boolean(opts.sinceId) && !nextToken);
  }

  private async request(
    query: string,
    opts: RecentSearchRequest,
    nextToken: string | null,
    timeoutMs: number,
  ): Promise<Response | "timeout" | "network"> {
    const params = recentSearchParams({
      query,
      maxResults: opts.maxResults,
      sinceId: opts.sinceId,
      startTime: opts.startTime,
      nextToken: nextToken ?? undefined,
    });
    const url = new URL(this.baseUrl + X_READ_PATHS.recent);
    for (const [key, value] of params) url.searchParams.set(key, value);
    this.options.limiter.markSent(this.now());
    try {
      return await this.fetchImpl(url, {
        method: "GET",
        headers: {
          authorization: `Bearer ${this.options.bearerToken}`,
          accept: "application/json",
        },
        signal: withTimeout(opts.signal, timeoutMs),
      });
    } catch (error) {
      return isAbort(error) ? "timeout" : "network";
    }
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

export function recentSearchParams(input: {
  query: string;
  maxResults?: number;
  sinceId?: string;
  startTime?: string;
  nextToken?: string;
}): URLSearchParams {
  if (input.sinceId && input.startTime) {
    throw new Error("since_id and start_time are mutually exclusive");
  }
  const params = new URLSearchParams();
  params.set("query", input.query);
  params.set("max_results", String(clampResults(input.maxResults ?? 10)));
  params.set("tweet.fields", TWEET_FIELDS);
  params.set("sort_order", "recency");
  if (input.nextToken) params.set("next_token", input.nextToken);
  if (input.sinceId) params.set("since_id", input.sinceId);
  else if (input.startTime) params.set("start_time", input.startTime);
  if (params.has("since_id") && params.has("start_time")) params.delete("start_time");
  params.delete("expansions");
  params.delete("user.fields");
  return params;
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

export function laterSnowflake(current: string | null, candidate: string | null): string | null {
  if (!candidate || !/^\d+$/.test(candidate)) return current;
  if (!current || !/^\d+$/.test(current)) return candidate;
  return BigInt(candidate) > BigInt(current) ? candidate : current;
}

function blank(
  outcome: SearchOutcome,
  httpStatus: number | null,
  problemType: string | null,
): RecentSearchReport {
  return {
    outcome,
    httpStatus,
    posts: [],
    returned: 0,
    newestId: null,
    problemType,
    cursorWritable: false,
    partialErrors: [],
  };
}

function stop(
  outcome: SearchOutcome,
  httpStatus: number | null,
  problemType: string | null,
): { kind: "stop"; outcome: SearchOutcome; httpStatus: number | null; problemType: string | null } {
  return { kind: "stop", outcome, httpStatus, problemType };
}

async function classify(
  response: Response,
  sinceIdSent: boolean,
): Promise<
  | {
      kind: "page";
      posts: ReadPost[];
      returned: number;
      newestId: string | null;
      nextToken: string | null;
      errors: { type: string }[];
    }
  | { kind: "stop"; outcome: SearchOutcome; httpStatus: number | null; problemType: string | null }
> {
  const status = response.status;
  if (status === 401 || status === 403) return stop("auth", status, "auth");
  if (status === 400) return stop(sinceIdSent ? "bad_since" : "error", 400, "bad_request");
  const body = await readJson(response);
  if (status === 429) {
    return stop(
      usageCapped(body) ? "usage_capped" : "rate",
      429,
      problemType(body) ?? "rate_limit",
    );
  }
  if (status >= 500) return stop("server", status, "server");
  if (!response.ok) return stop("error", status, problemType(body) ?? "error");
  const tweets = Array.isArray((body as { data?: unknown } | null)?.data)
    ? ((body as { data: TweetPayload[] }).data ?? [])
    : [];
  const posts = tweets.flatMap((tweet) => {
    const post = toReadPost(tweet);
    return post ? [post] : [];
  });
  let newestId: string | null = null;
  const meta = (body as { meta?: { newest_id?: unknown; next_token?: unknown } } | null)?.meta;
  if (meta && typeof meta.newest_id === "string")
    newestId = laterSnowflake(newestId, meta.newest_id);
  for (const post of posts) newestId = laterSnowflake(newestId, post.postMaterial);
  const token = meta && typeof meta.next_token === "string" ? meta.next_token : null;
  return {
    kind: "page",
    posts,
    returned: tweets.length,
    newestId,
    nextToken: token,
    errors: partialErrors(body),
  };
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

async function waitFor(ms: number, signal?: AbortSignal): Promise<boolean> {
  try {
    await delay(ms, signal);
    return true;
  } catch {
    return false;
  }
}

function retryDelayMs(headers: HeaderBag, now: number): number {
  const retry = headers.get("retry-after");
  if (retry !== null && retry !== "" && Number.isFinite(Number(retry))) {
    return Math.max(0, Number(retry) * 1000);
  }
  const reset = headers.get("x-rate-limit-reset");
  if (reset !== null && reset !== "" && Number.isFinite(Number(reset))) {
    return Math.max(0, Number(reset) * 1000 - now);
  }
  return 1_000;
}

function withTimeout(signal: AbortSignal | undefined, ms: number): AbortSignal {
  const timeout = AbortSignal.timeout(ms);
  if (!signal) return timeout;
  return AbortSignal.any([signal, timeout]);
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

async function peek(response: Response): Promise<unknown> {
  try {
    return await response.clone().json();
  } catch {
    return null;
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function problemType(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const type = (body as { type?: unknown }).type;
  if (typeof type === "string") return safeProblemType(type);
  const errors = (body as { errors?: unknown }).errors;
  if (Array.isArray(errors) && errors[0] && typeof errors[0] === "object") {
    const nested = (errors[0] as { type?: unknown }).type;
    if (typeof nested === "string") return safeProblemType(nested);
  }
  return null;
}

export function safeProblemType(value: string): string {
  if (value.length > 120 || /bearer|authorization|token=/i.test(value)) return "unknown";
  return value;
}

function usageCapped(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const type = (body as { type?: unknown }).type;
  if (type === USAGE_CAPPED) return true;
  const title = (body as { title?: unknown }).title;
  const detail = (body as { detail?: unknown }).detail;
  const text =
    `${typeof title === "string" ? title : ""} ${typeof detail === "string" ? detail : ""}`.toLowerCase();
  if (text.includes("usage-capped") || text.includes("usage capped")) return true;
  if (text.includes("credit") && text.includes("exhaust")) return true;
  if (text.includes("spending limit") || text.includes("spend limit")) return true;
  return false;
}

function partialErrors(body: unknown): { type: string }[] {
  if (!body || typeof body !== "object" || !Array.isArray((body as { errors?: unknown }).errors)) {
    return [];
  }
  const errors: { type: string }[] = [];
  for (const entry of (body as { errors: unknown[] }).errors) {
    if (!entry || typeof entry !== "object") continue;
    const type = (entry as { type?: unknown }).type;
    const title = (entry as { title?: unknown }).title;
    const label = typeof type === "string" ? type : typeof title === "string" ? title : "unknown";
    errors.push({ type: safeProblemType(label) });
  }
  return errors;
}
