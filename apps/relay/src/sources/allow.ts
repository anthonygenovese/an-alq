/** Hosts for the Nixle adapter. The default source has an empty list. */
export const NIXLE_SOURCE_ID = "nixle";

export const NIXLE_HOSTS = ["nixle.us", "local.nixle.com", "nixle.com", "www.nixle.com"] as const;

export function hostsForSource(source: string | null): readonly string[] {
  if (source === NIXLE_SOURCE_ID) return NIXLE_HOSTS;
  return [];
}

/** Exact host match. A subdomain counts only when that subdomain is listed. */
export function hostListed(hostname: string, hosts: readonly string[]): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return hosts.some((allowed) => host === allowed.toLowerCase());
}

export function hostAllowed(url: string, hosts: readonly string[]): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  return hostListed(parsed.hostname, hosts);
}
