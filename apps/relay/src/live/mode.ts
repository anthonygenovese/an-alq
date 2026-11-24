/** Empty or "none" means the cron has no live source. */
export function configuredRelaySource(env: Record<string, string | undefined>): string | null {
  const raw = env.RELAY_SOURCE?.trim().toLowerCase() ?? "";
  if (raw === "" || raw === "none") return null;
  return raw;
}

/** Live reads require live mode and production, unless preview is explicitly allowed. */
export function livePollingAllowed(env: Record<string, string | undefined>): boolean {
  if (env.RELAY_MODE !== "live") return false;
  if (env.RELAY_STREAM === "1") return false;
  return env.VERCEL_ENV === "production" || env.RELAY_ALLOW_PREVIEW === "1";
}

export function redisRest(
  env: Record<string, string | undefined>,
): { url: string; token: string } | null {
  const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}
