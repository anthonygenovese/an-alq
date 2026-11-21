/**
 * Stderr only. stdout belongs to the stdio MCP transport.
 * Callers pass an event name plus string or number fields. They cannot attach
 * a body, a ZIP, or an address through this function's types.
 */
export type LogEvent =
  | "mcp_request"
  | "mcp_error"
  | "rate_limited"
  | "bad_request"
  | "listen_error";

export function logEvent(
  event: LogEvent,
  fields: Record<string, string | number> = {},
): void {
  const payload: Record<string, string | number> = {
    ts: new Date().toISOString(),
    event,
  };
  for (const [key, value] of Object.entries(fields)) {
    if (key === "event" || key === "ts") continue;
    payload[key] = value;
  }
  console.error(JSON.stringify(payload));
}
