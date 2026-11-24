/**
 * Live source ids this process may read.
 * Empty: every RELAY_SOURCE value resolves to none.
 */
export const APPROVED_RELAY_SOURCES: readonly string[] = [];

/** Query for an approved source. Anything off the list has no query. */
export function searchQueryForSource(sourceId: string): string | null {
  void sourceId;
  return null;
}
