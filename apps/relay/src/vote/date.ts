// SPDX-License-Identifier: MIT
export interface SignedDate {
  /** ISO time from the Date header. Null when the header is missing or unparseable. */
  iso: string | null;
  /** True only when the DKIM h= list includes date. */
  dkimCoversDate: boolean;
  domain: string | null;
  selector: string | null;
}

/**
 * The signed Date header is the recency clock. Gmail internalDate is not read.
 * DKIM coverage is whatever the h= tag lists. This does not verify the signature.
 */
export function readSignedDate(rfc822: string): SignedDate {
  const headers = unfoldHeaders(rfc822);
  const dkim = headers.find((header) => header.name === "dkim-signature")?.value ?? "";
  const tags = dkimTags(dkim);
  const signed = (tags.h ?? "")
    .split(":")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const dateRaw = headers.find((header) => header.name === "date")?.value ?? "";
  const parsed = Date.parse(dateRaw);
  return {
    iso: Number.isFinite(parsed) ? new Date(parsed).toISOString() : null,
    dkimCoversDate: signed.includes("date"),
    domain: tags.d ?? null,
    selector: tags.s ?? null,
  };
}

export function freshAt(
  provenIso: string,
  now: number,
  windowMs: number,
  skewMs = 120_000,
): boolean {
  const proven = Date.parse(provenIso);
  if (!Number.isFinite(proven)) return false;
  if (proven > now + skewMs) return false;
  return now - proven <= windowMs;
}

function unfoldHeaders(rfc822: string): { name: string; value: string }[] {
  const head = rfc822.split(/\r?\n\r?\n/)[0] ?? "";
  const lines = head.split(/\r?\n/);
  const headers: { name: string; value: string }[] = [];
  for (const line of lines) {
    if (/^[ \t]/.test(line) && headers.length > 0) {
      const last = headers[headers.length - 1];
      if (last) last.value += ` ${line.trim()}`;
      continue;
    }
    const split = line.match(/^([^:]+):\s*(.*)$/);
    if (!split?.[1]) continue;
    headers.push({ name: split[1].trim().toLowerCase(), value: split[2] ?? "" });
  }
  return headers;
}

function dkimTags(value: string): Record<string, string> {
  const tags: Record<string, string> = {};
  for (const part of value.split(";")) {
    const match = part.match(/^\s*([a-zA-Z]+)\s*=\s*([\s\S]*)$/);
    if (!match?.[1]) continue;
    tags[match[1].toLowerCase()] = (match[2] ?? "").replace(/\s+/g, "").trim();
  }
  return tags;
}
