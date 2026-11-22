const HOSTS = new Set(["nixle.us", "local.nixle.com", "nixle.com", "www.nixle.com"]);

export interface NixleRef {
  url: string;
  key: string;
}

export function isNixleHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (HOSTS.has(host)) return true;
  return host.endsWith(".nixle.us") || host.endsWith(".nixle.com");
}

function cleanUrlToken(raw: string): string {
  return raw.replace(/[),.;>\]]+$/, "");
}

export function extractNixle(text: string, urls: readonly string[]): NixleRef | null {
  const found = [...urls, ...(text.match(/https?:\/\/[^\s<>"']+/gi) ?? [])];
  for (const raw of found) {
    let parsed: URL;
    try {
      parsed = new URL(cleanUrlToken(raw));
    } catch {
      continue;
    }
    if (!isNixleHost(parsed.hostname)) continue;
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.replace(/\/+$/, "") || "/";
    const numeric = path.match(/\/(?:alert|alerts)\/(\d+)$/i)?.[1] ?? null;
    const slug = path.match(/^\/([a-z0-9]{4,})$/i)?.[1] ?? null;
    const canonical = `https://${host}${path}`;
    const key = numeric
      ? `id:${numeric}`
      : slug
        ? `slug:${slug.toLowerCase()}`
        : `url:${canonical}`;
    return { url: canonical, key };
  }
  return null;
}
