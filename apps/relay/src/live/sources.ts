import { nixleSearchQuery } from "../nixle/adapter.js";
import { NIXLE_SOURCE_ID } from "../sources/allow.js";

/**
 * Live source ids this process may read.
 * Anything not listed resolves to none.
 */
export const APPROVED_RELAY_SOURCES: readonly string[] = [NIXLE_SOURCE_ID];

/** Query for an approved source. Anything off the list has no query. */
export function searchQueryForSource(sourceId: string): string | null {
  if (sourceId === NIXLE_SOURCE_ID) return nixleSearchQuery;
  return null;
}
