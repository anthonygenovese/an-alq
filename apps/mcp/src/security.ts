// SPDX-License-Identifier: MIT
import type { IncomingMessage, ServerResponse } from "node:http";
import type { NextFunction, Request, Response } from "express";
import type { AppMode } from "./client-address.js";
import { logEvent } from "./log.js";

export const SECURITY_HEADERS: readonly (readonly [string, string])[] = [
  ["X-Content-Type-Options", "nosniff"],
  ["X-Frame-Options", "DENY"],
  ["Referrer-Policy", "no-referrer"],
  ["Permissions-Policy", "camera=(), microphone=(), geolocation=()"],
  ["Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"],
  ["Cross-Origin-Resource-Policy", "same-origin"],
  ["Cross-Origin-Opener-Policy", "same-origin"],
  ["X-DNS-Prefetch-Control", "off"],
  ["X-Permitted-Cross-Domain-Policies", "none"],
  ["Cache-Control", "no-store"],
];

const ALLOW_METHODS = "GET, POST, OPTIONS";
const ALLOW_HEADERS = "Content-Type, Accept, Mcp-Protocol-Version, Mcp-Session-Id, Last-Event-ID";
const EXPOSE_HEADERS = "X-RateLimit-Limit, X-RateLimit-Remaining, Retry-After";

export interface HttpGuardOptions {
  mode: AppMode;
  allowedOrigins: readonly string[];
}

export function applySecurityHeaders(res: ServerResponse): void {
  for (const [key, value] of SECURITY_HEADERS) res.setHeader(key, value);
}

/**
 * Browser callers must present an allowlisted Origin. `*` is never a valid
 * entry. Local mode also allows `http://localhost` and `http://127.0.0.1`
 * with an optional port, so the Inspector UI on a loopback port can connect.
 * Requests with no Origin header are non-browser clients and proceed.
 * A rejected Origin is not copied into the response or the log.
 */
export function applyHttpGuards(
  req: IncomingMessage,
  res: ServerResponse,
  options: HttpGuardOptions,
): { proceed: boolean } {
  applySecurityHeaders(res);
  const header = req.headers.origin;
  if (Array.isArray(header)) {
    rejectOrigin(res);
    return { proceed: false };
  }
  const decision = originDecision(header, options);
  if (decision === "deny") {
    rejectOrigin(res);
    return { proceed: false };
  }
  if (decision === "allow" && header) {
    res.setHeader("Access-Control-Allow-Origin", header);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", ALLOW_METHODS);
    res.setHeader("Access-Control-Allow-Headers", ALLOW_HEADERS);
    res.setHeader("Access-Control-Expose-Headers", EXPOSE_HEADERS);
    res.setHeader("Access-Control-Max-Age", "600");
    if ((req.method ?? "GET").toUpperCase() === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return { proceed: false };
    }
  }
  return { proceed: true };
}

export function httpGuards(options: HttpGuardOptions) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const decision = applyHttpGuards(req, res, options);
    if (decision.proceed) next();
  };
}

export function allowedOriginsFromEnv(env: NodeJS.ProcessEnv = process.env): readonly string[] {
  return parseOriginList(env.ALLOWED_ORIGINS);
}

export function parseOriginList(raw: string | undefined): string[] {
  if (!raw) return [];
  const origins: string[] = [];
  for (const part of raw.split(",")) {
    const trimmed = part.trim();
    if (!trimmed || trimmed === "*") continue;
    const origin = canonicalOrigin(trimmed);
    if (origin) origins.push(origin);
  }
  return origins;
}

export function canonicalOrigin(value: string): string | undefined {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return undefined;
  }
  if (url.username || url.password) return undefined;
  if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
  if ((url.pathname !== "/" && url.pathname !== "") || url.search || url.hash) return undefined;
  return url.origin;
}

export type OriginDecision = "absent" | "allow" | "deny";

export function originDecision(
  originHeader: string | undefined,
  options: HttpGuardOptions,
): OriginDecision {
  if (originHeader === undefined || originHeader.length === 0) return "absent";
  const origin = canonicalOrigin(originHeader);
  if (!origin || origin !== originHeader) return "deny";
  if (options.allowedOrigins.includes(origin)) return "allow";
  if (options.mode === "local" && isLoopbackOrigin(origin)) return "allow";
  return "deny";
}

function isLoopbackOrigin(origin: string): boolean {
  const url = new URL(origin);
  return url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
}

function rejectOrigin(res: ServerResponse): void {
  logEvent("cors_rejected", { status: 403, code: "origin" });
  const body = JSON.stringify({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Origin not allowed" },
    id: null,
  });
  res.statusCode = 403;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(body);
}
