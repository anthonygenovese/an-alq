// SPDX-License-Identifier: MIT
import type { IncomingMessage, ServerResponse } from "node:http";
import { RATE_LIMIT } from "../src/config.js";
import { clientAddress } from "../src/client-address.js";
import { handleMcpRequest } from "../src/mcp-http.js";
import { SlidingWindowRateLimiter, bucketKeyFromAddress } from "../src/rate-limit.js";
import { allowedOriginsFromEnv, applyHttpGuards } from "../src/security.js";

const rateLimiter = new SlidingWindowRateLimiter(RATE_LIMIT.limit, RATE_LIMIT.windowMs);

type NodeRequest = IncomingMessage & { body?: unknown };

/**
 * Vercel Node function. Stateless streamable HTTP at /api/mcp.
 * vercel.json rewrites /mcp to this function.
 * The rate-limit key is a hash of the platform-observed address. The raw
 * address is not logged, and a client-supplied x-forwarded-for is ignored.
 */
export default function handler(req: NodeRequest, res: ServerResponse): Promise<void> | void {
  const decision = applyHttpGuards(req, res, {
    mode: "vercel",
    allowedOrigins: allowedOriginsFromEnv(),
  });
  if (!decision.proceed) return;
  const bucketKey = bucketKeyFromAddress(clientAddress(req, "vercel"));
  return handleMcpRequest(req, res, req.body, { rateLimiter, bucketKey });
}
