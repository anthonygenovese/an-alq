import http from "node:http";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import type { IncomingMessage, ServerResponse } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import health from "../api/health.js";
import mcp from "../api/mcp.js";

type Handler = (req: IncomingMessage & { body?: unknown }, res: ServerResponse) => unknown;

function serve(handler: Handler) {
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      const nodeReq = req as IncomingMessage & { body?: unknown };
      if (raw.length > 0) {
        try {
          nodeReq.body = JSON.parse(raw);
        } catch {
          nodeReq.body = undefined;
        }
      }
      void handler(nodeReq, res);
    });
  });
  return server;
}

describe("Vercel handlers", () => {
  const previous = process.env.ALLOWED_ORIGINS;
  const servers: http.Server[] = [];

  afterEach(async () => {
    if (previous === undefined) delete process.env.ALLOWED_ORIGINS;
    else process.env.ALLOWED_ORIGINS = previous;
    for (const server of servers.splice(0)) {
      server.closeAllConnections?.();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  async function listen(handler: Handler) {
    const server = serve(handler);
    servers.push(server);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address() as AddressInfo;
    return `http://127.0.0.1:${address.port}`;
  }

  it("answers /api/health and refuses a cross-origin caller", async () => {
    delete process.env.ALLOWED_ORIGINS;
    const url = await listen(health);
    const ok = await fetch(url);
    expect(ok.status).toBe(200);
    expect(ok.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await ok.json()).toMatchObject({ ok: true, name: "an-alq" });
    const denied = await fetch(url, { headers: { origin: "https://evil.example" } });
    expect(denied.status).toBe(403);
    expect(await denied.text()).not.toContain("evil.example");
  });

  it("serves the MCP function when no Origin is sent", async () => {
    delete process.env.ALLOWED_ORIGINS;
    const url = await listen(mcp);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "handler-test", version: "0.0.0" },
        },
      }),
    });
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain("an-alq");
    expect(text).not.toContain("203.0.113.10");
  });
});
