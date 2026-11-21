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

export function htmlToText(html: string): string {
  const withBreaks = html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n");
  const withoutTags = withBreaks.replace(/<[^>]*>/g, " ");
  return decodeEntitiesOnce(withoutTags)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\s+/g, " ")
    .trim();
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
