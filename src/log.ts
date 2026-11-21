/**
 * Stderr only. stdout belongs to the stdio MCP transport.
 * The payload is an allowlist. Callers cannot attach a body, a ZIP, an
 * address, or a header through this function: unknown keys are dropped,
 * and string fields must match a fixed shape.
 */
export type LogEvent =
  "mcp_request" | "mcp_error" | "rate_limited" | "bad_request" | "cors_rejected" | "listen_error";

export interface LogFields {
  status?: number;
  code?: string;
  rid?: string;
  method?: string;
}

const CODE = /^[A-Za-z][A-Za-z0-9_]{0,31}$/;
const RID = /^[a-f0-9]{16}$/;

const RPC_METHODS = new Set([
  "initialize",
  "ping",
  "notifications/initialized",
  "notifications/cancelled",
  "tools/list",
  "tools/call",
  "resources/list",
  "resources/read",
  "resources/templates/list",
  "prompts/list",
  "prompts/get",
  "completion/complete",
  "logging/setLevel",
]);

export function logEvent(event: LogEvent, fields: LogFields = {}): void {
  const payload: Record<string, string | number> = {
    ts: new Date().toISOString(),
    event,
  };
  if (isStatus(fields.status)) payload.status = fields.status;
  if (typeof fields.code === "string" && CODE.test(fields.code)) payload.code = fields.code;
  if (typeof fields.rid === "string" && RID.test(fields.rid)) payload.rid = fields.rid;
  if (typeof fields.method === "string" && RPC_METHODS.has(fields.method)) {
    payload.method = fields.method;
  }
  console.error(JSON.stringify(payload));
}

function isStatus(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 599;
}
