// SPDX-License-Identifier: MIT
import { once } from "node:events";
import http, { type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { afterEach, describe, expect, it } from "vitest";
import packageJson from "../package.json" with { type: "json" };
import { createApp } from "../src/app.js";
import { SlidingWindowRateLimiter } from "../src/rate-limit.js";
import { captureConsole } from "./console.js";

const PLANTED = "01945";
const ACCEPT = "application/json, text/event-stream";

function postWithHost(
  url: URL,
  host: string,
  body: string,
): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: "POST",
        headers: {
          host,
          accept: ACCEPT,
          "content-type": "application/json",
          "content-length": Buffer.byteLength(body),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            text: Buffer.concat(chunks).toString("utf8"),
          });
        });
      },
    );
    req.on("error", reject);
    req.end(body);
  });
}

async function listen(app: ReturnType<typeof createApp>) {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  return { server, url: `http://127.0.0.1:${address.port}` };
}

async function close(server: Server) {
  server.closeAllConnections?.();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

describe("streamable HTTP", () => {
  const servers: Server[] = [];
  const consoles: Array<ReturnType<typeof captureConsole>> = [];

  afterEach(async () => {
    for (const captured of consoles.splice(0)) captured.restore();
    for (const server of servers.splice(0)) await close(server);
  });

  it("lists tools through the official client and does not log a ZIP", async () => {
    const captured = captureConsole();
    consoles.push(captured);
    const { server, url } = await listen(createApp());
    servers.push(server);
    const client = new Client({ name: "an-alq-http-test", version: "0.0.0" });
    const transport = new StreamableHTTPClientTransport(new URL(`${url}/mcp`));
    await client.connect(transport);
    const listed = await client.listTools();
    expect(listed.tools.map((tool) => tool.name).sort()).toEqual([
      "explain_ew_term",
      "get_capabilities",
      "get_emitter_library",
      "get_frontier_picks",
      "get_news_drop",
    ]);
    const news = await client.callTool({
      name: "get_news_drop",
      arguments: { slot: "morning", zip: PLANTED },
    });
    expect(news.isError).toBeUndefined();
    expect(JSON.stringify(news)).toContain(PLANTED);
    const response = await fetch(`${url}/health`);
    expect(response.status).toBe(200);
    expect(captured.text()).not.toContain(PLANTED);
    expect(captured.text()).not.toMatch(/\d{1,3}(?:\.\d{1,3}){3}/);
    await client.close();
  });

  it("rejects an unknown field and a hostile Host before echoing them", async () => {
    const captured = captureConsole();
    consoles.push(captured);
    const { server, url } = await listen(createApp());
    servers.push(server);
    const rejected = await fetch(`${url}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: ACCEPT },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 7,
        method: "tools/call",
        params: {
          name: "get_news_drop",
          arguments: { slot: "morning", zip: "00501", email: PLANTED },
        },
      }),
    });
    expect(rejected.status).toBe(400);
    const text = await rejected.text();
    expect(text).toContain("Unrecognized key");
    expect(text).not.toContain(PLANTED);
    expect(rejected.headers.get("cache-control")).toBe("no-store");

    const hostile = await postWithHost(
      new URL(`${url}/mcp`),
      "evil.example",
      JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" }),
    );
    expect(hostile.status).toBe(403);
    expect(captured.text()).not.toContain(PLANTED);
    expect(captured.text()).not.toContain("evil.example");
    expect(captured.text()).not.toMatch(/\d{1,3}(?:\.\d{1,3}){3}/);
  });

  it("rate limits a bucket and answers invalid JSON without logging the body", async () => {
    const captured = captureConsole();
    consoles.push(captured);
    const limiter = new SlidingWindowRateLimiter(2, 60_000);
    const { server, url } = await listen(createApp({ rateLimiter: limiter }));
    servers.push(server);
    const post = () =>
      fetch(`${url}/mcp`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: ACCEPT },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: "get_capabilities", arguments: {} },
        }),
      });
    expect((await post()).status).toBe(200);
    expect((await post()).status).toBe(200);
    const blocked = await post();
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBeTruthy();

    const garbage = await fetch(`${url}/api/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: `{"zip":"${PLANTED}"`,
    });
    expect([400, 429]).toContain(garbage.status);
    expect(await garbage.text()).not.toContain(PLANTED);
    expect(captured.text()).not.toContain(PLANTED);
    expect(captured.text()).not.toMatch(/\d{1,3}(?:\.\d{1,3}){3}/);
  });

  it("serves /healthz with security headers and a strict CORS policy", async () => {
    const captured = captureConsole();
    consoles.push(captured);
    const { server, url } = await listen(createApp());
    servers.push(server);

    const healthz = await fetch(`${url}/healthz`);
    expect(healthz.status).toBe(200);
    expect(await healthz.json()).toEqual({
      ok: true,
      name: "an-alq",
      version: packageJson.version,
    });
    expect(healthz.headers.get("x-content-type-options")).toBe("nosniff");
    expect(healthz.headers.get("x-frame-options")).toBe("DENY");
    expect(healthz.headers.get("referrer-policy")).toBe("no-referrer");
    expect(healthz.headers.get("cache-control")).toBe("no-store");
    expect(healthz.headers.get("content-security-policy")).toContain("default-src 'none'");
    expect(healthz.headers.get("access-control-allow-origin")).toBeNull();

    const loopback = await fetch(`${url}/healthz`, {
      headers: { origin: "http://127.0.0.1:6274" },
    });
    expect(loopback.status).toBe(200);
    expect(loopback.headers.get("access-control-allow-origin")).toBe("http://127.0.0.1:6274");
    expect(loopback.headers.get("access-control-allow-credentials")).toBeNull();

    const preflight = await fetch(`${url}/mcp`, {
      method: "OPTIONS",
      headers: { origin: "http://localhost:6274", "access-control-request-method": "POST" },
    });
    expect(preflight.status).toBe(204);

    const denied = await fetch(`${url}/mcp`, {
      method: "POST",
      headers: {
        origin: "https://evil.example",
        "content-type": "application/json",
        accept: ACCEPT,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "get_news_drop", arguments: { slot: "morning", zip: PLANTED } },
      }),
    });
    expect(denied.status).toBe(403);
    const deniedText = await denied.text();
    expect(deniedText).not.toContain("evil.example");
    expect(deniedText).not.toContain(PLANTED);
    expect(denied.headers.get("access-control-allow-origin")).toBeNull();
    expect(captured.text()).not.toContain("evil.example");
    expect(captured.text()).not.toContain(PLANTED);
  });

  it("rejects an oversized body without logging it", async () => {
    const captured = captureConsole();
    consoles.push(captured);
    const { server, url } = await listen(createApp());
    servers.push(server);
    const planted = `PII${PLANTED}`;
    const body = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "get_capabilities", arguments: { note: planted.repeat(8000) } },
    });
    expect(Buffer.byteLength(body)).toBeGreaterThan(32 * 1024);
    const response = await fetch(`${url}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: ACCEPT },
      body,
    });
    expect(response.status).toBe(413);
    expect(await response.text()).not.toContain(planted);
    expect(captured.text()).not.toContain(planted);
  });

  it("does not let a forged x-forwarded-for hop the Vercel rate-limit bucket", async () => {
    const limiter = new SlidingWindowRateLimiter(1, 60_000);
    const { server, url } = await listen(createApp({ mode: "vercel", rateLimiter: limiter }));
    servers.push(server);
    const post = (forwardedFor: string) =>
      fetch(`${url}/mcp`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: ACCEPT,
          "x-forwarded-for": forwardedFor,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: "get_capabilities", arguments: {} },
        }),
      });
    expect((await post("203.0.113.10")).status).toBe(200);
    expect((await post("203.0.113.11")).status).toBe(429);
  });

  it("denies loopback origins in Vercel mode unless they are listed", async () => {
    const { server, url } = await listen(createApp({ mode: "vercel" }));
    servers.push(server);
    const denied = await fetch(`${url}/healthz`, {
      headers: { origin: "http://127.0.0.1:6274" },
    });
    expect(denied.status).toBe(403);

    const allowedApp = createApp({
      mode: "vercel",
      allowedOrigins: ["https://mcp.an-alq.com"],
    });
    const allowed = await listen(allowedApp);
    servers.push(allowed.server);
    const ok = await fetch(`${allowed.url}/healthz`, {
      headers: { origin: "https://mcp.an-alq.com" },
    });
    expect(ok.status).toBe(200);
    expect(ok.headers.get("access-control-allow-origin")).toBe("https://mcp.an-alq.com");
  });
});
