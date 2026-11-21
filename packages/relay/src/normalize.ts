const URL_PATTERN = /https?:\/\/\S+/gi;
const WWW_PATTERN = /\bwww\.\S+/gi;
const HANDLE_PATTERN = /@[\w_]+/g;
const HASHTAG_PATTERN = /#[\w_]+/g;

/** Readable alert text. URLs, handles, and hashtags are removed. Case stays. */
export function displaySummary(input: string): string {
  const cleaned = input
    .replace(URL_PATTERN, " ")
    .replace(WWW_PATTERN, " ")
    .replace(HANDLE_PATTERN, " ")
    .replace(HASHTAG_PATTERN, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, 240);
}

/**
 * Fingerprint text. Case, whitespace, URLs, handles, and hashtags do not
 * survive. Punctuation becomes a space.
 */
export function normalizeAlertText(input: string): string {
  const folded = input.toLowerCase();
  const stripped = folded
    .replace(URL_PATTERN, " ")
    .replace(WWW_PATTERN, " ")
    .replace(HANDLE_PATTERN, " ")
    .replace(HASHTAG_PATTERN, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return stripped;
}

export function wordTokens(normalized: string): string[] {
  if (!normalized) return [];
  return normalized.split(" ").filter((word) => word.length > 0);
}
