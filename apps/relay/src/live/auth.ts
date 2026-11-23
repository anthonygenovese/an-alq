import { timingSafeEqual } from "node:crypto";

/** True only for the exact bearer secret. The header is never logged. */
export function cronAuthorized(authorization: string | null, secret: string | undefined): boolean {
  if (!secret || !authorization) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(authorization);
  if (expected.length !== given.length) return false;
  return timingSafeEqual(expected, given);
}
