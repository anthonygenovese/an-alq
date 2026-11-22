import { randomBytes, sha256Hex, utf8 } from "./sha256.js";

export const BANNED_PUBLIC_KEYS: readonly string[] = [
  "handle",
  "handles",
  "username",
  "userName",
  "screenName",
  "userId",
  "user_id",
  "author",
  "authorId",
  "author_id",
  "profile",
  "avatar",
  "dedupToken",
  "account",
  "accountId",
  "accountMaterial",
  "postMaterial",
  "salt",
  "karma",
  "score",
  "points",
  "rank",
  "ranking",
  "leaderboard",
  "relayCount",
  "firstPoster",
  "credit",
  "diya",
  "mandala",
  "messageId",
  "message_id",
  "threadId",
  "thread_id",
  "emailAddress",
  "email_address",
  "deliveredTo",
  "mailbox",
];

const banned = new Set(BANNED_PUBLIC_KEYS);

export function findBannedKey(value: unknown, path = "$"): string | null {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = findBannedKey(value[index], `${path}[${index}]`);
      if (found) return found;
    }
    return null;
  }
  if (!value || typeof value !== "object") return null;
  for (const [key, child] of Object.entries(value)) {
    if (banned.has(key)) return `${path}.${key}`;
    const found = findBannedKey(child, `${path}.${key}`);
    if (found) return found;
  }
  return null;
}

/**
 * In-memory salt for transient dedup hashes. The salt is a private field,
 * rotates on a timer, and is never serialized. After rotation every hash is
 * discarded by the caller. Nothing here is written to disk.
 */
export class RotatingSalt {
  #salt: Uint8Array;
  #generation = 1;
  #rotatedAt: number;

  constructor(
    private readonly intervalMs: number,
    private readonly random: () => Uint8Array = () => randomBytes(32),
    rotatedAt = 0,
  ) {
    if (intervalMs < 1) throw new Error("salt interval must be positive");
    this.#salt = this.random();
    this.#rotatedAt = rotatedAt;
  }

  get generation(): number {
    return this.#generation;
  }

  hash(material: string, now: number): string {
    this.rotateIfDue(now);
    return sha256Hex([this.#salt, new Uint8Array([0]), utf8(material)]);
  }

  rotate(now: number): void {
    this.#salt = this.random();
    this.#generation += 1;
    this.#rotatedAt = now;
  }

  rotateIfDue(now: number): boolean {
    if (now - this.#rotatedAt < this.intervalMs) return false;
    this.rotate(now);
    return true;
  }
}
