// SPDX-License-Identifier: MIT
import { extractFromPost, stripAddresses } from "../extract.js";
import type { AlertExtract } from "../extract.js";
import type { Geocoder } from "../types.js";

const HEADER =
  /^(from|to|cc|bcc|delivered-to|reply-to|return-path|sender|message-id|received|dkim-signature|authentication-results|mime-version|content-type|content-transfer-encoding|x-[\w-]+):/i;

/**
 * Paste box. No mailbox access. Header lines are dropped before extraction.
 */
export function parsePastedNixleMail(
  raw: string,
  geocoder: Geocoder,
  observedAt = Date.now(),
): AlertExtract | null {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const kept: string[] = [];
  let subject = "";
  for (const line of lines) {
    const match = line.match(/^subject:\s*(.*)$/i);
    if (match?.[1] && !subject) {
      subject = match[1].trim();
      continue;
    }
    if (HEADER.test(line.trim())) continue;
    kept.push(line);
  }
  const text = stripAddresses(`${subject}\n${kept.join("\n")}`)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!text) return null;
  return extractFromPost(
    {
      text,
      createdAt: observedAt,
      urls: text.match(/https?:\/\/[^\s<>"']+/gi) ?? [],
      accountMaterial: null,
      postMaterial: "paste",
    },
    geocoder,
  );
}
