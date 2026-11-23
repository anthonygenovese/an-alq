import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { containsEmail, parseIngestBody } from "../src/ingest.js";
import { cronAuthorized } from "../src/live/auth.js";
import { postsAffordable } from "../src/live/budget.js";
import { livePollingAllowed } from "../src/live/mode.js";
import {
  CURSOR_KEY,
  PAUSE_KEY,
  SNAPSHOT_KEY,
  handleIngest,
  readPublicSnapshot,
  runRelayPoll,
  type RelayKv,
} from "../src/live/poll.js";
import { assertPublic, tightenSummary } from "../src/live/public.js";
import { NIXLE_SEARCH_QUERY, XReader, recentSearchParams } from "../src/x/read.js";
import { XRateLimiter } from "../src/x/limit.js";

const NOW = Date.parse("2026-01-15T15:00:00.000Z");
const NIXLE = "https://local.nixle.com/alert/1000042";
const TWEET_A = "1781111111111111101";
const TWEET_B = "1781111111111111102";
const TWEET_C = "1781111111111111103";

function memoryKv(initial: Record<string, string> = {}): RelayKv & { values: Map<string, string> } {
  const values = new Map(Object.entries(initial));
  return {
    values,
    async get(key) {
      return values.get(key) ?? null;
    },
    async set(key, value) {
      values.set(key, value);
    },
    async incrby(key, amount) {
      const next = Number(values.get(key) ?? "0") + amount;
      values.set(key, String(next));
      return next;
    },
    async expire() {},
    async del(key) {
      values.delete(key);
    },
  };
}

function liveEnv(extra: Record<string, string> = {}): Record<string, string> {
  return {
    RELAY_MODE: "live",
    VERCEL_ENV: "production",
    CRON_SECRET: "cron-test",
    X_BEARER_TOKEN: "read-token-test",
    ...extra,
  };
}

function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  const headerMap = new Map(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  );
  const response = {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (name: string) => headerMap.get(name.toLowerCase()) ?? null },
    clone() {
      return this;
    },
    json: async () => body,
  };
  return response as unknown as Response;
}

function tweet(id: string, text: string, url?: string) {
  return {
    id,
    text,
    created_at: "2026-01-15T15:00:00.000Z",
    author_id: "author-should-not-leak",
    ...(url ? { entities: { urls: [{ expanded_url: url }] } } : {}),
  };
}

function searchBody(tweets: ReturnType<typeof tweet>[], extra: Record<string, unknown> = {}) {
  return { data: tweets, ...extra };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("cron auth", () => {
  it("rejects anything except the bearer secret", () => {
    expect(cronAuthorized(null, "cron-test")).toBe(false);
    expect(cronAuthorized("Bearer other", "cron-test")).toBe(false);
    expect(cronAuthorized("Bearer cron-test", undefined)).toBe(false);
    expect(cronAuthorized("Bearer cron-test", "cron-test")).toBe(true);
  });
});

describe("live poll", () => {
  it("rejects an unauthenticated call and does not read outside production", async () => {
    const denied = await runRelayPoll({
      env: liveEnv(),
      authorization: null,
      kv: memoryKv(),
      now: NOW,
    });
    expect(denied.status).toBe(401);
    expect(livePollingAllowed({ RELAY_MODE: "live", VERCEL_ENV: "preview" })).toBe(false);
    expect(
      livePollingAllowed({ RELAY_MODE: "live", VERCEL_ENV: "preview", RELAY_ALLOW_PREVIEW: "1" }),
    ).toBe(true);
    let called = false;
    const demo = await runRelayPoll({
      env: { ...liveEnv(), VERCEL_ENV: "preview" },
      authorization: "Bearer cron-test",
      kv: memoryKv(),
      now: NOW,
      fetchImpl: async () => {
        called = true;
        return jsonResponse(200, searchBody([]));
      },
    });
    expect(called).toBe(false);
    expect(demo.body.skipped).toBe("demo");
  });

  it("does not call X in demo mode and falls back when redis or the token is missing", async () => {
    let called = false;
    const demo = await runRelayPoll({
      env: { ...liveEnv(), RELAY_MODE: "demo" },
      authorization: "Bearer cron-test",
      kv: memoryKv(),
      now: NOW,
      fetchImpl: async () => {
        called = true;
        return jsonResponse(200, searchBody([]));
      },
    });
    expect(called).toBe(false);
    expect(demo.body.skipped).toBe("demo");
    const noRedis = await runRelayPoll({
      env: liveEnv(),
      authorization: "Bearer cron-test",
      kv: null,
      now: NOW,
    });
    expect(noRedis.body.skipped).toBe("redis");
    const fallback = await readPublicSnapshot(null, NOW);
    expect(fallback.mode).toBe("demo");
    expect(fallback.demo).toBe(true);
    expect(fallback.items).toEqual([]);
    const noToken = await runRelayPoll({
      env: { ...liveEnv(), X_BEARER_TOKEN: "" },
      authorization: "Bearer cron-test",
      kv: memoryKv(),
      now: NOW,
    });
    expect(noToken.body.skipped).toBe("token");
  });

  it("cold-starts with start_time only, then polls with since_id only", async () => {
    const urls: string[] = [];
    const kv = memoryKv();
    await runRelayPoll({
      env: liveEnv(),
      authorization: "Bearer cron-test",
      now: NOW,
      kv,
      fetchImpl: async (url) => {
        urls.push(String(url));
        return jsonResponse(
          200,
          searchBody([tweet(TWEET_A, `Road closure. ${NIXLE}`, NIXLE)], {
            meta: { newest_id: TWEET_A },
          }),
        );
      },
    });
    const cold = new URL(urls[0] ?? "");
    expect(cold.searchParams.get("query")).toBe(NIXLE_SEARCH_QUERY);
    expect(cold.searchParams.get("tweet.fields")).toBe("created_at,entities,author_id");
    expect(cold.searchParams.get("sort_order")).toBe("recency");
    expect(cold.searchParams.get("max_results")).toBe("100");
    expect(cold.searchParams.get("start_time")).toBeTruthy();
    expect(cold.searchParams.has("since_id")).toBe(false);
    expect(cold.searchParams.has("expansions")).toBe(false);
    expect(cold.searchParams.has("user.fields")).toBe(false);
    const cursor = JSON.parse(kv.values.get(CURSOR_KEY) ?? "{}") as { newest_id?: string };
    expect(cursor.newest_id).toBe(TWEET_A);
    const snapshot = kv.values.get(SNAPSHOT_KEY) ?? "";
    expect(snapshot).not.toContain(TWEET_A);
    expect(snapshot).not.toContain("newest_id");
    expect(snapshot).not.toContain("author-should-not-leak");
    expect(snapshot).not.toContain("author_id");

    urls.length = 0;
    await runRelayPoll({
      env: liveEnv(),
      authorization: "Bearer cron-test",
      now: NOW + 1_000,
      kv,
      fetchImpl: async (url) => {
        urls.push(String(url));
        return jsonResponse(200, searchBody([]));
      },
    });
    const steady = new URL(urls[0] ?? "");
    expect(steady.searchParams.get("since_id")).toBe(TWEET_A);
    expect(steady.searchParams.has("start_time")).toBe(false);
    expect(steady.searchParams.get("max_results")).toBe("10");
  });

  it("drops a non-Nixle post and keeps banned keys out of the snapshot", async () => {
    const kv = memoryKv();
    const result = await runRelayPoll({
      env: liveEnv(),
      authorization: "Bearer cron-test",
      now: NOW,
      kv,
      fetchImpl: async () =>
        jsonResponse(
          200,
          searchBody([
            tweet(TWEET_A, "Road work. Call 555-010-0199 at 10 Main Street.", NIXLE),
            tweet(TWEET_B, "A note with no alert link."),
          ]),
        ),
    });
    expect(result.body.read).toBe(2);
    expect(result.body.status).toBe("ok");
    const stored = kv.values.get(SNAPSHOT_KEY) ?? "";
    const parsed = JSON.parse(stored) as { items: { summary: string; nixleUrl: string }[] };
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]?.nixleUrl).toBe(NIXLE);
    expect(parsed.items[0]?.summary).not.toMatch(/555|Street/);
    expect(stored).not.toContain("author");
    expect(stored).not.toContain('"lat"');
    expect(stored).not.toContain(TWEET_A);
    expect(stored).not.toContain(TWEET_B);
    assertPublic(parsed);
    expect(tightenSummary("Call 555-010-0199 at 10 Main Street")).not.toMatch(/555|Street/);
    expect(() => assertPublic({ author_id: "nope" })).toThrow(/banned key/);
  });

  it("stops before another run would cross the budget", async () => {
    expect(postsAffordable(2991, 15, 0.005, 10)).toBe(0);
    const kv = memoryKv({ "an-alq:relay:budget:2026-01": "2991" });
    let called = false;
    const result = await runRelayPoll({
      env: liveEnv(),
      authorization: "Bearer cron-test",
      now: NOW,
      kv,
      fetchImpl: async () => {
        called = true;
        return jsonResponse(200, searchBody([]));
      },
    });
    expect(called).toBe(false);
    expect(result.body.skipped).toBe("budget");
  });

  it("drops a card once it is past the inactivity window", async () => {
    const kv = memoryKv({
      [SNAPSHOT_KEY]: JSON.stringify({
        generated_at: new Date(NOW - 50 * 60_000).toISOString(),
        mode: "live",
        demo: false,
        stale: false,
        status: "ok",
        error: null,
        disclaimer:
          "Not an emergency service. If you need help, call 911. This view shows aggregated public-agency alert text only. Senders are not shown.",
        stats: { liveSignals: 1, relaysInWindow: 1, windowMs: 1_800_000 },
        sources: [{ id: "x", sensitivity: "low", enabled: true, privateData: false }],
        items: [
          {
            summary: "Old road work",
            category: "traffic",
            agency: "Caltrans",
            jurisdiction: null,
            firstSeen: new Date(NOW - 50 * 60_000).toISOString(),
            lastSeen: new Date(NOW - 46 * 60_000).toISOString(),
            nixleUrl: NIXLE,
            pulse: { periodMs: 1_000, opacity: 0.4 },
            receptions: 0,
            receptionMark: "none",
          },
        ],
      }),
    });
    const result = await runRelayPoll({
      env: liveEnv(),
      authorization: "Bearer cron-test",
      now: NOW,
      kv,
      fetchImpl: async () => jsonResponse(200, searchBody([])),
    });
    expect(result.body.status).toBe("empty");
    expect(kv.values.get(SNAPSHOT_KEY)).not.toContain("Old road work");
  });

  it("caps a tick at three pages, marks it truncated, and still advances the cursor", async () => {
    const urls: string[] = [];
    const kv = memoryKv();
    const pages = [
      searchBody([tweet(TWEET_C, `One. ${NIXLE}`, NIXLE)], {
        meta: { newest_id: TWEET_C, next_token: "page-2" },
      }),
      searchBody([tweet(TWEET_B, `Two. ${NIXLE}`, NIXLE)], {
        meta: { newest_id: TWEET_B, next_token: "page-3" },
      }),
      searchBody([tweet(TWEET_A, `Three. ${NIXLE}`, NIXLE)], {
        meta: { newest_id: TWEET_A, next_token: "page-4" },
      }),
    ];
    const result = await runRelayPoll({
      env: liveEnv(),
      authorization: "Bearer cron-test",
      now: NOW,
      kv,
      fetchImpl: async (url) => {
        urls.push(String(url));
        return jsonResponse(200, pages[urls.length - 1] ?? searchBody([]));
      },
    });
    expect(urls).toHaveLength(3);
    expect(new URL(urls[2] ?? "").searchParams.get("next_token")).toBe("page-3");
    expect(urls.some((url) => url.includes("page-4"))).toBe(false);
    expect(result.body.status).toBe("truncated");
    const cursor = JSON.parse(kv.values.get(CURSOR_KEY) ?? "{}") as { newest_id?: string };
    expect(cursor.newest_id).toBe(TWEET_C);
  });

  it("retries a rejected since_id once with start_time and never sends both", async () => {
    const urls: string[] = [];
    const kv = memoryKv({
      [CURSOR_KEY]: JSON.stringify({
        newest_id: TWEET_A,
        updated_at: new Date(NOW - 60_000).toISOString(),
      }),
    });
    await runRelayPoll({
      env: liveEnv(),
      authorization: "Bearer cron-test",
      now: NOW,
      kv,
      fetchImpl: async (url) => {
        urls.push(String(url));
        const params = new URL(String(url)).searchParams;
        expect(params.has("since_id") && params.has("start_time")).toBe(false);
        if (params.has("since_id")) return jsonResponse(400, { title: "bad request" });
        return jsonResponse(200, searchBody([tweet(TWEET_B, `Rebuilt. ${NIXLE}`, NIXLE)]));
      },
    });
    expect(urls).toHaveLength(2);
    expect(new URL(urls[1] ?? "").searchParams.has("since_id")).toBe(false);
    expect(new URL(urls[1] ?? "").searchParams.get("start_time")).toBeTruthy();
    const cursor = JSON.parse(kv.values.get(CURSOR_KEY) ?? "{}") as { newest_id?: string };
    expect(cursor.newest_id).toBe(TWEET_B);
  });

  it("pauses until the next cycle when usage is capped", async () => {
    const kv = memoryKv();
    let called = 0;
    const first = await runRelayPoll({
      env: liveEnv(),
      authorization: "Bearer cron-test",
      now: NOW,
      kv,
      fetchImpl: async () => {
        called += 1;
        return jsonResponse(429, {
          type: "https://api.x.com/2/problems/usage-capped",
          title: "Credits exhausted",
        });
      },
    });
    expect(first.body.status).toBe("error");
    expect(kv.values.get(PAUSE_KEY)).toBeTruthy();
    const second = await runRelayPoll({
      env: liveEnv(),
      authorization: "Bearer cron-test",
      now: NOW + 1_000,
      kv,
      fetchImpl: async () => {
        called += 1;
        return jsonResponse(200, searchBody([]));
      },
    });
    expect(second.body.skipped).toBe("paused");
    expect(called).toBe(1);
  });

  it("keeps generated_at when a later tick only marks the snapshot stale", async () => {
    const generated = "2026-01-15T14:00:00.000Z";
    const kv = memoryKv({
      [SNAPSHOT_KEY]: JSON.stringify({
        generated_at: generated,
        mode: "live",
        demo: false,
        stale: false,
        status: "ok",
        error: null,
        disclaimer:
          "Not an emergency service. If you need help, call 911. This view shows aggregated public-agency alert text only. Senders are not shown.",
        stats: { liveSignals: 0, relaysInWindow: 0, windowMs: 1_800_000 },
        sources: [{ id: "x", sensitivity: "low", enabled: true, privateData: false }],
        items: [],
      }),
    });
    const result = await runRelayPoll({
      env: liveEnv(),
      authorization: "Bearer cron-test",
      now: NOW,
      kv,
      timeoutMs: 20,
      fetchImpl: (_url, init) =>
        new Promise((_resolve, reject) => {
          const fail = () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
          if (init?.signal?.aborted) fail();
          else init?.signal?.addEventListener("abort", fail, { once: true });
        }),
    });
    expect(result.body.status).toBe("error");
    expect(kv.values.has(CURSOR_KEY)).toBe(false);
    const stored = JSON.parse(kv.values.get(SNAPSHOT_KEY) ?? "{}") as {
      generated_at: string;
      stale: boolean;
      error: { message: string } | null;
    };
    expect(stored.generated_at).toBe(generated);
    expect(stored.stale).toBe(true);
    expect(stored.error?.message).not.toMatch(/https?:|bearer|authorization/i);
  });

  it("does not retry an auth failure, and retries one server error before going stale", async () => {
    const generated = "2026-01-15T14:00:00.000Z";
    const prior = {
      generated_at: generated,
      mode: "live",
      demo: false,
      stale: false,
      status: "ok",
      error: null,
      disclaimer:
        "Not an emergency service. If you need help, call 911. This view shows aggregated public-agency alert text only. Senders are not shown.",
      stats: { liveSignals: 0, relaysInWindow: 0, windowMs: 1_800_000 },
      sources: [{ id: "x", sensitivity: "low", enabled: true, privateData: false }],
      items: [],
    };
    const authKv = memoryKv({ [SNAPSHOT_KEY]: JSON.stringify(prior) });
    let authCalls = 0;
    const auth = await runRelayPoll({
      env: liveEnv(),
      authorization: "Bearer cron-test",
      now: NOW,
      kv: authKv,
      fetchImpl: async () => {
        authCalls += 1;
        return jsonResponse(401, { title: "Unauthorized" });
      },
    });
    expect(authCalls).toBe(1);
    expect(auth.body.status).toBe("error");
    expect(JSON.parse(authKv.values.get(SNAPSHOT_KEY) ?? "{}").generated_at).toBe(generated);

    const serverKv = memoryKv({ [SNAPSHOT_KEY]: JSON.stringify(prior) });
    let serverCalls = 0;
    const server = await runRelayPoll({
      env: liveEnv(),
      authorization: "Bearer cron-test",
      now: NOW,
      kv: serverKv,
      fetchImpl: async () => {
        serverCalls += 1;
        return jsonResponse(503, { title: "unavailable" });
      },
    });
    expect(serverCalls).toBe(2);
    expect(server.body.status).toBe("error");
    const stored = JSON.parse(serverKv.values.get(SNAPSHOT_KEY) ?? "{}") as {
      generated_at: string;
      stale: boolean;
    };
    expect(stored.stale).toBe(true);
    expect(stored.generated_at).toBe(generated);
    expect(serverKv.values.has(CURSOR_KEY)).toBe(false);
  });

  it("logs search errors without the post text or an authorization header", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const kv = memoryKv();
    await runRelayPoll({
      env: liveEnv(),
      authorization: "Bearer cron-test",
      now: NOW,
      kv,
      fetchImpl: async () =>
        jsonResponse(200, {
          data: [tweet(TWEET_A, `Road closure. ${NIXLE}`, NIXLE)],
          errors: [
            {
              type: "partial",
              title: "partial",
              detail: "Authorization: Bearer read-token-test 555-010-0199",
            },
          ],
        }),
    });
    const logged = spy.mock.calls.map((call) => call.join(" ")).join("\n");
    expect(logged).toContain("partial");
    expect(logged).not.toContain("read-token-test");
    expect(logged).not.toContain("555-010-0199");
    expect(logged.toLowerCase()).not.toContain("authorization");
  });
});

describe("x reader", () => {
  it("only issues GET and does not ask for author expansions", () => {
    const source = readFileSync(new URL("../src/x/read.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/method:\s*"POST"/);
    expect(source).not.toContain('set("expansions"');
    expect(source).not.toContain('set("user.fields"');
    expect(source).toContain('tweet.fields", TWEET_FIELDS');
    expect(() =>
      recentSearchParams({ query: "q", sinceId: "10", startTime: "2026-01-01T00:00:00.000Z" }),
    ).toThrow(/mutually exclusive/);
  });

  it("searches with GET", async () => {
    let method = "";
    const reader = new XReader({
      bearerToken: "read-token-test",
      limiter: new XRateLimiter(0),
      fetchImpl: async (_url, init) => {
        method = init?.method ?? "";
        return jsonResponse(200, searchBody([]));
      },
    });
    await reader.searchRecent("(url:nixle.com) -is:retweet", { maxResults: 10 });
    expect(method).toBe("GET");
  });
});

describe("ingest", () => {
  it("rejects a bearer-like summary and an unauthenticated call", async () => {
    const kv = memoryKv();
    const denied = await handleIngest({
      env: liveEnv(),
      authorization: null,
      body: {},
      kv,
      now: NOW,
    });
    expect(denied.status).toBe(401);
    const rejected = await handleIngest({
      env: liveEnv(),
      authorization: "Bearer cron-test",
      kv,
      now: NOW,
      body: {
        summary: "Authorization: Bearer abc",
        category: "traffic",
        observedAt: "2026-01-15T15:00:00.000Z",
        nixleUrl: NIXLE,
      },
    });
    expect(rejected.status).toBe(400);
  });

  it("rejects a long percent string without a polynomial scan", () => {
    const attack = "%".repeat(50_000);
    const started = performance.now();
    expect(containsEmail(attack)).toBe(true);
    expect(containsEmail("%".repeat(2_000))).toBe(false);
    expect(containsEmail("%".repeat(80) + "a@b.co")).toBe(true);
    const parsed = parseIngestBody({
      summary: attack,
      category: "traffic",
      observedAt: "2026-01-15T15:00:00.000Z",
      nixleUrl: NIXLE,
    });
    expect(parsed.ok).toBe(false);
    expect(performance.now() - started).toBeLessThan(100);
    const mailbox = parseIngestBody({
      summary: "Road work a@b.co",
      category: "traffic",
      observedAt: "2026-01-15T15:00:00.000Z",
      nixleUrl: NIXLE,
    });
    expect(mailbox.ok).toBe(false);
  });
});
