// SPDX-License-Identifier: MIT
import { randomBytes } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { GuardError, guardRpcBody, jsonRpcId } from "./guard.js";
import { logEvent } from "./log.js";
import type { SlidingWindowRateLimiter } from "./rate-limit.js";
import { applySecurityHeaders } from "./security.js";
import { createAnAlqServer } from "./server.js";

export interface McpHttpContext {
  rateLimiter: SlidingWindowRateLimiter;
  /** Pre-hashed bucket id. This handler never receives a raw address. */
  bucketKey: string;
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  if (res.headersSent) return;
  const body = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(body);
}

function requestMethod(body: unknown): string | undefined {
  if (typeof body !== "object" || body === null || Array.isArray(body) || !("method" in body)) {
    return undefined;
  }
  const method = body.method;
  return typeof method === "string" ? method : undefined;
}

export async function handleMcpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  body: unknown,
  ctx: McpHttpContext,
): Promise<void> {
  applySecurityHeaders(res);
  const rid = randomBytes(8).toString("hex");
  const rpcMethod = requestMethod(body);

  const decision = ctx.rateLimiter.check(ctx.bucketKey);
  res.setHeader("X-RateLimit-Limit", String(ctx.rateLimiter.limit));
  res.setHeader("X-RateLimit-Remaining", String(decision.allowed ? decision.remaining : 0));
  if (!decision.allowed) {
    logEvent("rate_limited", { status: 429, rid });
    res.setHeader("Retry-After", String(Math.max(1, Math.ceil(decision.retryAfterMs / 1000))));
    sendJson(res, 429, {
      jsonrpc: "2.0",
      error: { code: -32000, message: "Rate limit exceeded" },
      id: jsonRpcId(body),
    });
    return;
  }

  const method = req.method ?? "GET";
  if (method !== "POST") {
    logEvent("bad_request", { status: 405, rid });
    sendJson(res, 405, {
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed" },
      id: null,
    });
    return;
  }

  try {
    guardRpcBody(body);
  } catch (error) {
    const message = error instanceof GuardError ? error.message : "Invalid request";
    logEvent("bad_request", { status: 400, rid });
    sendJson(res, 400, {
      jsonrpc: "2.0",
      error: { code: -32602, message },
      id: jsonRpcId(body),
    });
    return;
  }

  logEvent("mcp_request", { rid, method: rpcMethod });

  const server = createAnAlqServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  transport.onerror = () => {
    logEvent("mcp_error", { code: "transport", rid });
  };

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
  } catch {
    logEvent("mcp_error", { code: "internal", rid });
    sendJson(res, 500, {
      jsonrpc: "2.0",
      error: { code: -32603, message: "Internal server error" },
      id: jsonRpcId(body),
    });
  } finally {
    await transport.close().catch(() => {
      logEvent("mcp_error", { code: "close", rid });
    });
    await server.close().catch(() => {
      logEvent("mcp_error", { code: "close", rid });
    });
  }
}
