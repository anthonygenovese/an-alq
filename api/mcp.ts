import type { IncomingMessage, ServerResponse } from "node:http";
import { RATE_LIMIT } from "../src/config.js";
import { handleMcpRequest } from "../src/mcp-http.js";
import { SlidingWindowRateLimiter, bucketKeyFromAddress } from "../src/rate-limit.js";

const rateLimiter = new SlidingWindowRateLimiter(RATE_LIMIT.limit, RATE_LIMIT.windowMs);

type NodeRequest = IncomingMessage & { body?: unknown };

function forwardedAddress(req: IncomingMessage): string {
  const header = req.headers["x-forwarded-for"];
  const raw = Array.isArray(header) ? header[0] : header;
  const first = raw?.split(",")[0]?.trim();
  return first || req.socket.remoteAddress || "vercel";
}

/**
 * Vercel Node function. Stateless streamable HTTP at /api/mcp.
 * vercel.json rewrites /mcp to this function.
 * The rate-limit key is a hash. The raw address is not logged.
 */
export default function handler(req: NodeRequest, res: ServerResponse): Promise<void> {
  const bucketKey = bucketKeyFromAddress(forwardedAddress(req));
  return handleMcpRequest(req, res, req.body, { rateLimiter, bucketKey });
}
