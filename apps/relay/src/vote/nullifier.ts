import { sha256Hex, utf8 } from "../sha256.js";

const DOMAIN = "an-alq.relay.nullifier.v1";

/**
 * One-time nullifier for a single signal. A different alert key yields a
 * different digest, so votes cannot be linked across signals. The inputs are
 * not recoverable from the hex.
 */
export function makeNullifier(alertKey: string, secret: string): string {
  return sha256Hex([utf8(DOMAIN), utf8("|"), utf8(alertKey), utf8("|"), utf8(secret)]);
}

export function isNullifier(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}
