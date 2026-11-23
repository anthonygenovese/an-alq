import { Redis } from "@upstash/redis";
import { SignalBoard } from "../board.js";
import { DEFAULT_DECAY } from "../decay.js";
import { OfflineStubGeocoder } from "../geo.js";
import { parseIngestBody } from "../ingest.js";
import { parsePost } from "../parse.js";
import { ContributionLedger, DEFAULT_GLOW } from "../participation.js";
import { findBannedKey } from "../privacy.js";
import { LIVE_BOARD, acceptRelay } from "../runtime.js";
import type { RawPost } from "../types.js";
import { XRateLimiter } from "../x/limit.js";
import type { RecentSearchReport } from "../x/read.js";
import { XReader } from "../x/read.js";
import { XSource } from "../x/source.js";
import { cronAuthorized } from "./auth.js";
import {
  budgetKey,
  clampRunMax,
  DEFAULT_UNIT_USD,
  postsAffordable,
  secondsUntilNextUtcMonth,
} from "./budget.js";
import { livePollingAllowed, redisRest } from "./mode.js";
import {
  demoSnapshot,
  liveSnapshot,
  publicItem,
  snapshotError,
  type PublicItem,
  type PublicSnapshot,
  type SnapshotError,
  type SnapshotStatus,
} from "./public.js";

export { demoSnapshot };

export const SNAPSHOT_KEY = "an-alq:relay:snapshot";
export const CURSOR_KEY = "an-alq:relay:cursor";
export const PAUSE_KEY = "an-alq:relay:paused-until";
export const CURSOR_TTL_SECONDS = 7 * 24 * 60 * 60;

const SEVEN_DAYS_MS = CURSOR_TTL_SECONDS * 1000;

export interface RelayKv {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  incrby(key: string, amount: number): Promise<number>;
  expire(key: string, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
}

export interface PollResult {
  status: number;
  body: Record<string, unknown>;
}

interface StoredCursor {
  newest_id: string;
  updated_at: string;
}

export function kvFromEnv(env: Record<string, string | undefined>): RelayKv | null {
  const rest = redisRest(env);
  if (!rest) return null;
  const redis = new Redis({ url: rest.url, token: rest.token });
  return {
    async get(key) {
      const value = await redis.get<unknown>(key);
      if (value === null || value === undefined) return null;
      return typeof value === "string" ? value : JSON.stringify(value);
    },
    async set(key, value, ttlSeconds) {
      await redis.set(key, value, { ex: ttlSeconds });
    },
    async incrby(key, amount) {
      return redis.incrby(key, amount);
    },
    async expire(key, ttlSeconds) {
      await redis.expire(key, ttlSeconds);
    },
    async del(key) {
      await redis.del(key);
    },
  };
}

export async function runRelayPoll(input: {
  env: Record<string, string | undefined>;
  authorization: string | null;
  now?: number;
  kv?: RelayKv | null;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<PollResult> {
  if (!cronAuthorized(input.authorization, input.env.CRON_SECRET)) {
    return { status: 401, body: { ok: false } };
  }
  if (!livePollingAllowed(input.env)) {
    return { status: 200, body: { ok: true, skipped: "demo" } };
  }
  const kv = input.kv === undefined ? kvFromEnv(input.env) : input.kv;
  if (!kv) return { status: 200, body: { ok: true, skipped: "redis" } };
  const token = input.env.X_BEARER_TOKEN;
  if (!token) return { status: 200, body: { ok: true, skipped: "token" } };

  const now = input.now ?? Date.now();
  const ttl = snapshotTtl(input.env);
  const paused = await kv.get(PAUSE_KEY);
  if (paused && Number(paused) > now) return { status: 200, body: { ok: true, skipped: "paused" } };

  const cap = budgetCap(input.env.RELAY_X_BUDGET_USD);
  if (cap === null) return { status: 200, body: { ok: true, status: "error", skipped: "budget" } };
  const unit = numberEnv(input.env.RELAY_X_UNIT_USD, DEFAULT_UNIT_USD);
  const cursor = parseCursor(await kv.get(CURSOR_KEY), now);
  const cold = cursor === null;
  const desired = clampRunMax(numberEnv(input.env.RELAY_X_MAX_RESULTS, cold ? 100 : 10));
  const spentRaw = await kv.get(budgetKey(now));
  const spent = spentRaw ? Number(spentRaw) : 0;
  const affordable = postsAffordable(Number.isFinite(spent) ? spent : 0, cap, unit, desired);
  if (affordable < 10) return { status: 200, body: { ok: true, skipped: "budget" } };

  const reader = new XReader({
    bearerToken: token,
    baseUrl: input.env.X_API_BASE,
    fetchImpl: input.fetchImpl,
    limiter: new XRateLimiter(0),
    now: () => now,
  });
  const source = new XSource(reader);
  const run = (sinceId?: string, startTime?: string) =>
    source.pullContract({
      sinceId,
      startTime,
      maxResults: affordable,
      timeoutMs: input.timeoutMs,
    });

  let remembered = cursor;
  let report = cursor
    ? await run(cursor.newest_id, undefined)
    : await run(undefined, coldStart(now));
  if (report.outcome === "bad_since") {
    await kv.del(CURSOR_KEY);
    remembered = null;
    report = await run(undefined, coldStart(now));
  }
  notePartial(report);
  if (report.outcome === "usage_capped") await pauseUntil(kv, now);

  if (!shouldPublish(report)) {
    await markStale(kv, now, errorFor(report), ttl);
    return { status: 200, body: { ok: true, status: "error" } };
  }

  const published = await publish(kv, now, report.posts, publishStatus(report), ttl);
  if (!published) return { status: 200, body: { ok: true, skipped: "privacy" } };
  if (shouldWriteCursor(report)) await writeCursor(kv, now, remembered, report);
  if (report.returned > 0) {
    const nextSpent = await kv.incrby(budgetKey(now), report.returned);
    await kv.expire(budgetKey(now), secondsUntilNextUtcMonth(now));
    if (nextSpent * unit > cap + 1e-9) await pauseUntil(kv, now);
  }
  const stored = parseStored(await kv.get(SNAPSHOT_KEY));
  return {
    status: 200,
    body: { ok: true, status: stored?.status ?? "ok", read: report.returned },
  };
}

export async function readPublicSnapshot(
  kv: RelayKv | null,
  now = Date.now(),
): Promise<PublicSnapshot> {
  if (!kv) return demoSnapshot(now);
  return parseStored(await kv.get(SNAPSHOT_KEY)) ?? demoSnapshot(now);
}

export async function handleIngest(input: {
  env: Record<string, string | undefined>;
  authorization: string | null;
  body: unknown;
  kv?: RelayKv | null;
  now?: number;
}): Promise<PollResult> {
  if (!cronAuthorized(input.authorization, input.env.CRON_SECRET)) {
    return { status: 401, body: { ok: false } };
  }
  const parsed = parseIngestBody(input.body);
  if (!parsed.ok) return { status: 400, body: { ok: false } };
  const kv = input.kv === undefined ? kvFromEnv(input.env) : input.kv;
  if (!kv) return { status: 200, body: { ok: true, stored: false } };
  const now = input.now ?? Date.now();
  const extract = parsed.extract;
  const candidate = parsePost(
    {
      text: `${extract.summary} ${extract.nixleUrl ?? ""}`.trim(),
      createdAt: Date.parse(extract.observedAt),
      urls: extract.nixleUrl ? [extract.nixleUrl] : [],
      accountMaterial: null,
      postMaterial: "",
    },
    new OfflineStubGeocoder(),
  );
  const posts: RawPost[] = candidate
    ? [
        {
          text: `${extract.summary} ${extract.nixleUrl ?? ""}`.trim(),
          createdAt: Date.parse(extract.observedAt),
          urls: extract.nixleUrl ? [extract.nixleUrl] : [],
          accountMaterial: null,
          postMaterial: "",
        },
      ]
    : [];
  const published = await publish(kv, now, posts, "ok", snapshotTtl(input.env));
  if (!published) return { status: 200, body: { ok: true, stored: false } };
  return { status: 200, body: { ok: true, stored: true } };
}

function shouldPublish(report: RecentSearchReport): boolean {
  if (report.outcome === "timeout" || report.outcome === "auth" || report.outcome === "bad_since") {
    return false;
  }
  if (report.outcome === "ok" || report.outcome === "empty" || report.outcome === "truncated") {
    return true;
  }
  return report.posts.length > 0;
}

function shouldWriteCursor(report: RecentSearchReport): boolean {
  if (report.outcome === "timeout" || report.outcome === "auth" || report.outcome === "bad_since") {
    return false;
  }
  if (report.cursorWritable) return true;
  return report.newestId !== null && report.posts.length > 0;
}

function publishStatus(report: RecentSearchReport): Exclude<SnapshotStatus, "demo" | "error"> {
  if (report.outcome === "truncated") return "truncated";
  if (report.outcome === "ok" || report.outcome === "empty") return "ok";
  return "truncated";
}

async function publish(
  kv: RelayKv,
  now: number,
  posts: readonly RawPost[],
  status: Exclude<SnapshotStatus, "demo" | "error">,
  ttlSeconds: number,
): Promise<boolean> {
  const board = new SignalBoard({
    ...LIVE_BOARD,
    decay: { ...LIVE_BOARD.decay, inactivityTtlMs: ttlSeconds * 1000 },
  });
  const geocoder = new OfflineStubGeocoder();
  const ledger = new ContributionLedger(DEFAULT_GLOW);
  const prior = parseStored(await kv.get(SNAPSHOT_KEY));
  if (prior) {
    for (const item of prior.items) rehydrate(board, geocoder, item, now, ttlSeconds * 1000);
  }
  for (const post of posts) acceptRelay(board, ledger, post, geocoder, now);
  board.prune(now);
  const items = board.signals(now).map(publicItem);
  let snapshot: PublicSnapshot;
  try {
    snapshot = liveSnapshot({
      now,
      status: items.length === 0 ? "empty" : status,
      stale: false,
      error: null,
      items,
      relaysInWindow: board.relayCountInWindow(now),
      windowMs: LIVE_BOARD.relayStatWindowMs,
    });
  } catch {
    return false;
  }
  if (findBannedKey(snapshot)) return false;
  await kv.set(SNAPSHOT_KEY, JSON.stringify(snapshot), ttlSeconds);
  return true;
}

function rehydrate(
  board: SignalBoard,
  geocoder: OfflineStubGeocoder,
  item: PublicItem,
  now: number,
  ttlMs: number,
): void {
  const createdAt = Date.parse(item.lastSeen);
  if (!Number.isFinite(createdAt) || now - createdAt >= ttlMs) return;
  const candidate = parsePost(
    {
      text: `${item.summary} ${item.nixleUrl ?? ""}`.trim(),
      createdAt,
      urls: item.nixleUrl ? [item.nixleUrl] : [],
      accountMaterial: null,
      postMaterial: "",
    },
    geocoder,
  );
  if (candidate) board.ingest(candidate, now);
}

async function markStale(
  kv: RelayKv,
  now: number,
  error: SnapshotError,
  ttlSeconds: number,
): Promise<void> {
  const prior = parseStored(await kv.get(SNAPSHOT_KEY));
  if (!prior) return;
  let next: PublicSnapshot;
  try {
    next = liveSnapshot({
      now,
      status: "error",
      stale: true,
      error,
      items: prior.items,
      relaysInWindow: prior.stats.relaysInWindow,
      windowMs: prior.stats.windowMs,
      generatedAt: prior.generated_at,
    });
  } catch {
    return;
  }
  if (findBannedKey(next)) return;
  await kv.set(SNAPSHOT_KEY, JSON.stringify(next), ttlSeconds);
}

async function writeCursor(
  kv: RelayKv,
  now: number,
  previous: StoredCursor | null,
  report: RecentSearchReport,
): Promise<void> {
  const newest = report.newestId ?? previous?.newest_id ?? null;
  if (!newest || !/^\d+$/.test(newest)) return;
  const cursor = { newest_id: newest, updated_at: new Date(now).toISOString() };
  await kv.set(CURSOR_KEY, JSON.stringify(cursor), CURSOR_TTL_SECONDS);
}

function parseCursor(raw: string | null, now: number): StoredCursor | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { newest_id?: unknown; updated_at?: unknown };
    if (typeof parsed.newest_id !== "string" || !/^\d+$/.test(parsed.newest_id)) return null;
    if (typeof parsed.updated_at !== "string") return null;
    const updated = Date.parse(parsed.updated_at);
    if (!Number.isFinite(updated) || now - updated > SEVEN_DAYS_MS) return null;
    return { newest_id: parsed.newest_id, updated_at: parsed.updated_at };
  } catch {
    return null;
  }
}

export function parseStored(raw: string | null): PublicSnapshot | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PublicSnapshot>;
    if (!parsed || parsed.mode !== "live" || typeof parsed.generated_at !== "string") return null;
    if (!Array.isArray(parsed.items)) return null;
    if (findBannedKey(parsed)) return null;
    return parsed as PublicSnapshot;
  } catch {
    return null;
  }
}

function notePartial(report: RecentSearchReport): void {
  if (report.partialErrors.length === 0) return;
  console.error(
    JSON.stringify({
      relay: "x-search-errors",
      count: report.partialErrors.length,
      types: report.partialErrors.map((entry) => entry.type).slice(0, 8),
    }),
  );
}

function errorFor(report: RecentSearchReport): SnapshotError {
  const status = report.httpStatus ?? 0;
  if (report.outcome === "auth") return snapshotError(status, "auth", "read rejected");
  if (report.outcome === "timeout") return snapshotError(status, "timeout", "read timed out");
  if (report.outcome === "usage_capped") return snapshotError(429, "usage_capped", "usage capped");
  if (report.outcome === "rate") return snapshotError(429, "rate_limit", "rate limited");
  if (report.outcome === "server") return snapshotError(status, "server", "upstream unavailable");
  return snapshotError(status, "error", "read failed");
}

async function pauseUntil(kv: RelayKv, now: number): Promise<void> {
  const seconds = secondsUntilNextUtcMonth(now);
  await kv.set(PAUSE_KEY, String(now + seconds * 1000), seconds);
}

function coldStart(now: number): string {
  return new Date(now - SEVEN_DAYS_MS + 120_000).toISOString();
}

function snapshotTtl(env: Record<string, string | undefined>): number {
  const ms = numberEnv(env.RELAY_INACTIVITY_TTL_MS, DEFAULT_DECAY.inactivityTtlMs);
  return Math.max(60, Math.floor(ms / 1000));
}

function budgetCap(value: string | undefined): number | null {
  if (value === undefined || value.trim() === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function numberEnv(value: string | undefined, fallback: number): number {
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
