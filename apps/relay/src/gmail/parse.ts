// SPDX-License-Identifier: MIT
import type { RawPost } from "../types.js";

export interface GmailHeader {
  name?: string;
  value?: string;
}

export interface GmailPart {
  mimeType?: string;
  headers?: GmailHeader[];
  body?: { data?: string; size?: number };
  parts?: GmailPart[];
}

/**
 * The fields this parser is willing to see. Address headers and ids may
 * arrive on the wire. They are not copied onto the result.
 */
export interface GmailMessageResource {
  id?: string;
  threadId?: string;
  internalDate?: string;
  snippet?: string;
  payload?: GmailPart;
}

const DROPPED_HEADERS = new Set([
  "from",
  "to",
  "cc",
  "bcc",
  "delivered-to",
  "reply-to",
  "return-path",
  "sender",
  "x-original-to",
]);

const RAW_TEXT_ELEMENTS = new Set(["script", "style"]);

/**
 * Plain text for an alert. Markup is skipped by a scan, not a regular
 * expression, and the result is never parsed as HTML. Entities are decoded
 * once, so `&amp;lt;` stays `&lt;`.
 */
export function htmlToText(html: string): string {
  return collapseSpace(decodeEntitiesOnce(stripMarkup(html)));
}

function stripMarkup(html: string): string {
  let out = "";
  let index = 0;
  while (index < html.length) {
    const open = html.indexOf("<", index);
    if (open < 0) {
      out += html.slice(index);
      break;
    }
    out += html.slice(index, open);
    const tag = readTag(html, open);
    if (!tag) {
      out += html.slice(open);
      break;
    }
    out += " ";
    index = tag.end;
    if (tag.kind === "comment" || tag.closing || tag.selfClosing) continue;
    if (!RAW_TEXT_ELEMENTS.has(tag.name)) continue;
    const close = findEndTag(html, index, tag.name);
    if (close !== null) index = close;
  }
  return out;
}

interface TagSpan {
  end: number;
  name: string;
  closing: boolean;
  selfClosing: boolean;
  kind: "tag" | "comment";
}

function readTag(html: string, open: number): TagSpan | null {
  if (html.startsWith("<!--", open)) {
    const end = commentEnd(html, open + 4);
    if (end < 0) return null;
    return { end, name: "", closing: false, selfClosing: false, kind: "comment" };
  }
  const end = tagEnd(html, open + 1);
  if (end < 0) return null;
  const parsed = parseTagInner(html.slice(open + 1, end - 1));
  return { end, ...parsed, kind: "tag" };
}

/** Index just past `>` that closes the tag whose body starts at `start`. Quotes hide `>`. */
function tagEnd(html: string, start: number): number {
  let quote = "";
  for (let index = start; index < html.length; index += 1) {
    const char = charAt(html, index);
    if (quote) {
      if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === ">") return index + 1;
  }
  return -1;
}

/** Comments end at `-->` or the parser-error form `--!>`. */
function commentEnd(html: string, start: number): number {
  const standard = html.indexOf("-->", start);
  const bang = html.indexOf("--!>", start);
  if (standard < 0 && bang < 0) return -1;
  if (standard < 0) return bang + 4;
  if (bang < 0) return standard + 3;
  return standard < bang ? standard + 3 : bang + 4;
}

function parseTagInner(inner: string): Pick<TagSpan, "name" | "closing" | "selfClosing"> {
  let index = skipSpace(inner, 0);
  let closing = false;
  if (charAt(inner, index) === "/") {
    closing = true;
    index = skipSpace(inner, index + 1);
  }
  let name = "";
  while (index < inner.length && isNameChar(charAt(inner, index))) {
    name += charAt(inner, index).toLowerCase();
    index += 1;
  }
  const trimmed = inner.trimEnd();
  const selfClosing = trimmed.endsWith("/") && !closing;
  return { name, closing, selfClosing };
}

function findEndTag(html: string, from: number, name: string): number | null {
  const needle = `</${name}`;
  let at = from;
  while (at < html.length) {
    const found = indexOfIgnoreCase(html, needle, at);
    if (found < 0) return null;
    const afterName = skipSpace(html, found + needle.length);
    if (charAt(html, afterName) === ">") return afterName + 1;
    at = found + 1;
  }
  return null;
}

/** ASCII tag names only. The haystack is not case-folded, so indexes stay aligned. */
function indexOfIgnoreCase(haystack: string, needle: string, from: number): number {
  const upper = needle.toUpperCase();
  const lower = needle.toLowerCase();
  const last = haystack.length - needle.length;
  for (let index = from; index <= last; index += 1) {
    let matched = true;
    for (let offset = 0; offset < needle.length; offset += 1) {
      const char = charAt(haystack, index + offset);
      if (char !== charAt(lower, offset) && char !== charAt(upper, offset)) {
        matched = false;
        break;
      }
    }
    if (matched) return index;
  }
  return -1;
}

function skipSpace(value: string, index: number): number {
  let cursor = index;
  while (cursor < value.length && isSpace(charAt(value, cursor))) cursor += 1;
  return cursor;
}

function isSpace(char: string): boolean {
  return char === " " || char === "\t" || char === "\n" || char === "\r" || char === "\f";
}

function isNameChar(char: string): boolean {
  const code = char.charCodeAt(0);
  return (
    (code >= 48 && code <= 57) ||
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122) ||
    char === "-" ||
    char === ":"
  );
}

function charAt(value: string, index: number): string {
  return value.charAt(index);
}

function collapseSpace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** One pass. `&amp;lt;` stays `&lt;` and is not turned into `<`. */
function decodeEntitiesOnce(text: string): string {
  return text.replace(
    /&(?:#(\d+)|#x([0-9a-f]+)|nbsp|amp|lt|gt|quot);/gi,
    (match, decimal: string | undefined, hex: string | undefined) => {
      if (decimal !== undefined) return codePointOrSpace(Number(decimal));
      if (hex !== undefined) return codePointOrSpace(Number.parseInt(hex, 16));
      switch (match.slice(1, -1).toLowerCase()) {
        case "nbsp":
          return " ";
        case "amp":
          return "&";
        case "lt":
          return "<";
        case "gt":
          return ">";
        case "quot":
          return '"';
        default:
          return match;
      }
    },
  );
}

function codePointOrSpace(code: number): string {
  if (!Number.isInteger(code) || code < 0 || code > 0x10ffff) return " ";
  return String.fromCodePoint(code);
}

export function decodeBase64Url(data: string): string {
  const padded = data.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const binary = globalThis.atob(padded + pad);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function headerValue(part: GmailPart | undefined, name: string): string | null {
  const target = name.toLowerCase();
  if (DROPPED_HEADERS.has(target)) return null;
  for (const header of part?.headers ?? []) {
    if ((header.name ?? "").toLowerCase() !== target) continue;
    const value = header.value?.trim();
    if (value) return value;
  }
  return null;
}

function collectBodies(
  part: GmailPart | undefined,
  into: { plain: string[]; html: string[] },
): void {
  if (!part) return;
  const data = part.body?.data;
  if (data && part.mimeType === "text/plain") into.plain.push(decodeBase64Url(data));
  else if (data && part.mimeType === "text/html") into.html.push(htmlToText(decodeBase64Url(data)));
  for (const child of part.parts ?? []) collectBodies(child, into);
}

/**
 * Subject, body, and internal time only. Message ids and address headers
 * are never copied to the returned post.
 */
export function alertFromGmailMessage(message: GmailMessageResource): RawPost | null {
  const internal = Number(message.internalDate);
  if (!Number.isFinite(internal)) return null;
  const subject = headerValue(message.payload, "Subject") ?? "";
  const bodies = { plain: [] as string[], html: [] as string[] };
  collectBodies(message.payload, bodies);
  const body = bodies.plain.join("\n") || bodies.html.join("\n");
  const text = `${subject}\n${body}`.trim();
  if (!text) return null;
  const urls = text.match(/https?:\/\/[^\s<>"']+/gi) ?? [];
  return {
    text,
    createdAt: internal,
    urls,
    accountMaterial: null,
    postMaterial: `mail|${internal}|${text.length}|${text.slice(0, 80)}`,
  };
}
