import { createHash } from "node:crypto";

const DOMAIN = "an-alq.relay.nullifier.v1";

/**
 * One-time nullifier for a single signal. A different alert key yields a
 * different digest, so votes cannot be linked across signals. The inputs are
 * not recoverable from the hex.
 */
export function makeNullifier(alertKey: string, secret: string): string {
  return createHash("sha256")
    .update(DOMAIN)
    .update("|")
    .update(alertKey)
    .update("|")
    .update(secret)
    .digest("hex");
}

export function isNullifier(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}
