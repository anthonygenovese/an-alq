// SPDX-License-Identifier: MIT
import { extractFromPost, stripAddresses } from "../extract.js";
import type { AlertExtract } from "../extract.js";
import { decodeBase64Url } from "./parse.js";
import { readSignedDate } from "../vote/date.js";
import { SENSOR_TOO_LATE } from "../copy.js";
import type { Geocoder } from "../types.js";

/** Five most recent Nixle messages. Other mail does not use a slot. */
export const INBOX_CAP = 5;
export const TOO_LATE = SENSOR_TOO_LATE;
export const DEFAULT_NIXLE_SENDERS = ["nixle.com", "nixle.us"] as const;

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me/messages";

export type InboxScan =
  | {
      status: "match";
      extract: AlertExtract;
      provenDate: string;
      dkimCoversDate: boolean;
      domain: string | null;
      selector: string | null;
    }
  | { status: "too_late" };

export interface InboxScanOptions {
  senders?: readonly string[];
  fetchImpl?: typeof fetch;
}

/**
 * Ask Gmail for the five newest inbox messages from a Nixle sender.
 * The query is the normal path, so a promotion or a GitHub mail is never
 * listed and never fetched. If that query is rejected, fall back to walking
 * inbox ids and reading only the From line of non-Nixle messages.
 */
export async function scanInboxForAlert(
  token: string,
  alertKey: string,
  geocoder: Geocoder,
  options: InboxScanOptions = {},
): Promise<InboxScan> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const query = nixleSenderQuery(options.senders ?? DEFAULT_NIXLE_SENDERS);
  const filtered = new URL(GMAIL_API);
  filtered.searchParams.set("labelIds", "INBOX");
  filtered.searchParams.set("q", query);
  filtered.searchParams.set("maxResults", String(INBOX_CAP));
  const listed = await gmailGet(filtered, token, fetchImpl);
  const ids = listed.ok
    ? readIds(listed.body).slice(0, INBOX_CAP)
    : await nixleIdsBySenderLine(token, fetchImpl);
  return matchAmong(ids, alertKey, geocoder, token, fetchImpl);
}

export function nixleSenderQuery(senders: readonly string[]): string {
  const safe = senders.filter((sender) => /^[a-z0-9.-]+$/i.test(sender));
  const list = safe.length > 0 ? safe : [...DEFAULT_NIXLE_SENDERS];
  return `from:(${list.join(" OR ")})`;
}

async function matchAmong(
  ids: readonly string[],
  alertKey: string,
  geocoder: Geocoder,
  token: string,
  fetchImpl: typeof fetch,
): Promise<InboxScan> {
  for (const id of ids.slice(0, INBOX_CAP)) {
    const rawUrl = new URL(`${GMAIL_API}/${encodeURIComponent(id)}`);
    rawUrl.searchParams.set("format", "raw");
    const payload = await gmailGet(rawUrl, token, fetchImpl);
    if (!payload.ok) continue;
    const raw = readRaw(payload.body);
    if (!raw) continue;
    const signed = readSignedDate(raw);
    const extract = extractFromRfc822(raw, geocoder, signed.iso);
    if (!extract || extract.sourceKey !== alertKey) continue;
    if (!signed.iso || !signed.dkimCoversDate) return { status: "too_late" };
    return {
      status: "match",
      extract,
      provenDate: signed.iso,
      dkimCoversDate: true,
      domain: signed.domain,
      selector: signed.selector,
    };
  }
  return { status: "too_late" };
}

/**
 * Used only when the sender query is unavailable. Non-Nixle ids get a From
 * header and nothing else. Slots count Nixle senders only, newest first.
 */
async function nixleIdsBySenderLine(token: string, fetchImpl: typeof fetch): Promise<string[]> {
  const found: string[] = [];
  let pageToken = "";
  for (let page = 0; page < 5 && found.length < INBOX_CAP; page += 1) {
    const listUrl = new URL(GMAIL_API);
    listUrl.searchParams.set("labelIds", "INBOX");
    listUrl.searchParams.set("maxResults", "20");
    if (pageToken) listUrl.searchParams.set("pageToken", pageToken);
    const listed = await gmailGet(listUrl, token, fetchImpl);
    if (!listed.ok) break;
    const ids = readIds(listed.body);
    pageToken = readPageToken(listed.body);
    for (const id of ids) {
      if (found.length >= INBOX_CAP) break;
      const metaUrl = new URL(`${GMAIL_API}/${encodeURIComponent(id)}`);
      metaUrl.searchParams.set("format", "metadata");
      metaUrl.searchParams.append("metadataHeaders", "From");
      const meta = await gmailGet(metaUrl, token, fetchImpl);
      const from = meta.ok ? readFrom(meta.body) : null;
      if (from && isNixleSender(from)) found.push(id);
    }
    if (!pageToken) break;
  }
  return found;
}

export function isNixleSender(from: string): boolean {
  const address = /<([^>]+)>/.exec(from)?.[1] ?? from;
  const at = address.lastIndexOf("@");
  if (at < 0) return false;
  const host = address
    .slice(at + 1)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.-].*$/, "");
  return (
    host === "nixle.com" ||
    host === "nixle.us" ||
    host.endsWith(".nixle.com") ||
    host.endsWith(".nixle.us")
  );
}

export function extractFromRfc822(
  rfc822: string,
  geocoder: Geocoder,
  provenIso: string | null,
): AlertExtract | null {
  const parts = rfc822.split(/\r?\n\r?\n/);
  const head = parts[0] ?? "";
  const body = parts.slice(1).join("\n\n");
  const subject = /^subject:\s*(.*)$/im.exec(head)?.[1]?.trim() ?? "";
  const text = stripAddresses(`${subject}\n${body}`);
  const when = provenIso ? Date.parse(provenIso) : Date.now();
  return extractFromPost(
    {
      text,
      createdAt: Number.isFinite(when) ? when : Date.now(),
      urls: text.match(/https?:\/\/[^\s<>"']+/gi) ?? [],
      accountMaterial: null,
      postMaterial: "inbox",
    },
    geocoder,
  );
}

async function gmailGet(
  url: URL,
  token: string,
  fetchImpl: typeof fetch,
): Promise<{ ok: true; body: unknown } | { ok: false }> {
  if (url.hostname !== "gmail.googleapis.com") throw new Error("gmail host refused");
  const response = await fetchImpl(url, {
    method: "GET",
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
  });
  if (!response.ok) return { ok: false };
  return { ok: true, body: await response.json() };
}

function readIds(payload: unknown): string[] {
  if (!payload || typeof payload !== "object" || !("messages" in payload)) return [];
  const messages = (payload as { messages?: { id?: string }[] }).messages ?? [];
  return messages.flatMap((message) => (message.id ? [message.id] : []));
}

function readPageToken(payload: unknown): string {
  if (!payload || typeof payload !== "object" || !("nextPageToken" in payload)) return "";
  const token = (payload as { nextPageToken?: string }).nextPageToken;
  return token ?? "";
}

function readFrom(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const headers =
    (payload as { payload?: { headers?: { name?: string; value?: string }[] } }).payload?.headers ??
    [];
  return headers.find((header) => (header.name ?? "").toLowerCase() === "from")?.value ?? null;
}

function readRaw(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || !("raw" in payload)) return null;
  const raw = (payload as { raw?: string }).raw;
  if (!raw) return null;
  return decodeBase64Url(raw);
}
