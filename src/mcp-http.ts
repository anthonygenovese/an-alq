import type { IncomingMessage, ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { GuardError, guardRpcBody, jsonRpcId } from "./guard.js";
import { logEvent } from "./log.js";
import type { SlidingWindowRateLimiter } from "./rate-limit.js";
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

export async function handleMcpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  body: unknown,
  ctx: McpHttpContext,
): Promise<void> {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  const decision = ctx.rateLimiter.check(ctx.bucketKey);
  res.setHeader("X-RateLimit-Limit", String(ctx.rateLimiter.limit));
  res.setHeader(
    "X-RateLimit-Remaining",
    String(decision.allowed ? decision.remaining : 0),
  );
  if (!decision.allowed) {
    logEvent("rate_limited", { status: 429 });
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
    logEvent("bad_request", { status: 400 });
    sendJson(res, 400, {
      jsonrpc: "2.0",
      error: { code: -32602, message },
      id: jsonRpcId(body),
    });
    return;
  }

  logEvent("mcp_request");

  const server = createAnAlqServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  transport.onerror = () => {
    logEvent("mcp_error", { code: "transport" });
  };

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
  } catch {
    logEvent("mcp_error", { code: "internal" });
    sendJson(res, 500, {
      jsonrpc: "2.0",
      error: { code: -32603, message: "Internal server error" },
      id: jsonRpcId(body),
    });
  } finally {
    await transport.close().catch(() => {
      logEvent("mcp_error", { code: "close" });
    });
    await server.close().catch(() => {
      logEvent("mcp_error", { code: "close" });
    });
  }
}
