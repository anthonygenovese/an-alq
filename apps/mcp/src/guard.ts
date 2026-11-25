// SPDX-License-Identifier: MIT
import { MAX_ARGUMENT_KEYS, ZIP_CHECK_IN_PROMPT } from "./config.js";
import { TOOL_INPUT_SCHEMAS, formatIssues, zipCheckInArgsSchema } from "./schemas.js";

export class GuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GuardError";
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertArgumentObject(value: unknown): Record<string, unknown> {
  if (!isPlainObject(value)) {
    throw new GuardError("arguments must be an object");
  }
  const keys = Object.keys(value);
  if (keys.length > MAX_ARGUMENT_KEYS) {
    throw new GuardError("Too many arguments");
  }
  return value;
}

/**
 * Rejects batches, non-objects, and unknown tool or prompt fields before the
 * SDK sees the body. Error text is built only from schema messages, which do
 * not echo submitted values.
 */
export function guardRpcBody(body: unknown): void {
  if (Array.isArray(body)) {
    throw new GuardError("Batch requests are not supported");
  }
  if (!isPlainObject(body)) return;
  const method = body.method;
  if (method !== "tools/call" && method !== "prompts/get") return;

  const params = body.params;
  if (!isPlainObject(params)) {
    throw new GuardError("params must be an object");
  }
  if (typeof params.name !== "string") {
    throw new GuardError("name must be a string");
  }
  const args = assertArgumentObject(params.arguments ?? {});

  if (method === "tools/call") {
    const schema = TOOL_INPUT_SCHEMAS[params.name as keyof typeof TOOL_INPUT_SCHEMAS];
    if (!schema) return;
    const parsed = schema.safeParse(args);
    if (!parsed.success) throw new GuardError(formatIssues(parsed.error));
    return;
  }

  if (params.name !== ZIP_CHECK_IN_PROMPT) return;
  const parsed = zipCheckInArgsSchema.safeParse(args);
  if (!parsed.success) throw new GuardError(formatIssues(parsed.error));
}

export function jsonRpcId(body: unknown): string | number | null {
  if (!isPlainObject(body)) return null;
  const id = body.id;
  if (typeof id === "string" || typeof id === "number") return id;
  return null;
}
