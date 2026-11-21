import type { IncomingMessage } from "node:http";

export type AppMode = "local" | "vercel";

/**
 * Identity for the in-memory rate limit.
 * On Vercel only `x-vercel-forwarded-for` is trusted. The platform strips
 * that header off the incoming request and sets it itself. A client-supplied
 * `x-forwarded-for` is ignored, so a caller cannot hop buckets by forging it.
 */
export function clientAddress(req: IncomingMessage, mode: AppMode): string {
  if (mode === "vercel") {
    const platform = firstHeader(req.headers["x-vercel-forwarded-for"]);
    const observed = platform?.split(",")[0]?.trim();
    if (observed) return observed;
    return req.socket?.remoteAddress || "vercel";
  }
  return req.socket?.remoteAddress ?? "local";
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}
