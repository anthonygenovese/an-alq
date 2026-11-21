import express, { type Express, type NextFunction, type Request, type Response } from "express";
import {
  hostHeaderValidation,
  localhostHostValidation,
} from "@modelcontextprotocol/sdk/server/middleware/hostHeaderValidation.js";
import { JSON_BODY_LIMIT, RATE_LIMIT, SERVER_NAME, SERVER_VERSION } from "./config.js";
import { clientAddress, type AppMode } from "./client-address.js";
import { handleMcpRequest } from "./mcp-http.js";
import { logEvent } from "./log.js";
import { SlidingWindowRateLimiter, bucketKeyFromAddress } from "./rate-limit.js";
import { httpGuards } from "./security.js";

export type { AppMode };

export interface CreateAppOptions {
  mode?: AppMode;
  rateLimiter?: SlidingWindowRateLimiter;
  allowedHosts?: readonly string[];
  allowedOrigins?: readonly string[];
}

const MCP_PATHS = ["/mcp", "/api/mcp"];
const HEALTH_PATHS = ["/health", "/healthz", "/api/health", "/api/healthz"];

function statusOf(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status?: unknown }).status;
    if (typeof status === "number") return status;
  }
  return undefined;
}

export function createApp(options: CreateAppOptions = {}): Express {
  const mode = options.mode ?? "local";
  const rateLimiter =
    options.rateLimiter ?? new SlidingWindowRateLimiter(RATE_LIMIT.limit, RATE_LIMIT.windowMs);
  const app = express();
  app.disable("x-powered-by");
  app.set("etag", false);
  app.set("query parser", "simple");
  app.use(
    httpGuards({
      mode,
      allowedOrigins: options.allowedOrigins ?? [],
    }),
  );

  if (mode === "local") {
    const allowed = options.allowedHosts?.filter((host) => host.length > 0);
    if (allowed && allowed.length > 0) {
      app.use(hostHeaderValidation([...allowed]));
    } else {
      app.use(localhostHostValidation());
    }
  }

  app.use(express.json({ limit: JSON_BODY_LIMIT, strict: true }));

  app.get(HEALTH_PATHS, (_req, res) => {
    res.json({ ok: true, name: SERVER_NAME, version: SERVER_VERSION });
  });

  const mcp = (req: Request, res: Response): Promise<void> => {
    const bucketKey = bucketKeyFromAddress(clientAddress(req, mode));
    return handleMcpRequest(req, res, req.body, { rateLimiter, bucketKey });
  };

  for (const path of MCP_PATHS) {
    app.post(path, mcp);
    app.get(path, mcp);
    app.delete(path, mcp);
  }

  app.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      next(error);
      return;
    }
    const status = statusOf(error);
    const onMcp = MCP_PATHS.includes(req.path);
    if (onMcp && (status === 400 || status === 413)) {
      const decision = rateLimiter.check(bucketKeyFromAddress(clientAddress(req, mode)));
      if (!decision.allowed) {
        logEvent("rate_limited", { status: 429 });
        res.setHeader("Retry-After", String(Math.max(1, Math.ceil(decision.retryAfterMs / 1000))));
        res.status(429).json({
          jsonrpc: "2.0",
          error: { code: -32000, message: "Rate limit exceeded" },
          id: null,
        });
        return;
      }
      logEvent("bad_request", { status });
      res.status(status).json({
        jsonrpc: "2.0",
        error: {
          code: status === 413 ? -32600 : -32700,
          message: status === 413 ? "Payload too large" : "Invalid JSON",
        },
        id: null,
      });
      return;
    }
    logEvent("mcp_error", { code: "internal" });
    res.status(500).json({
      jsonrpc: "2.0",
      error: { code: -32603, message: "Internal server error" },
      id: null,
    });
  });

  return app;
}
