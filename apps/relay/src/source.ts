import type { Category, RawPost, Sensitivity } from "./types.js";

/** Common public alert. No account, post id, or location. */
export interface Signal {
  sourceId: string;
  sourceKey: string;
  sourceUrl: string | null;
  summary: string;
  category: Category;
  agency: string | null;
}

/**
 * Server-side feeds are public reads only.
 * Gmail is not a server source. The browser holds that token, or it stays off.
 */
export interface SignalSource {
  readonly id: string;
  readonly sensitivity: Sensitivity;
  readonly privateData: boolean;
  pull(signal?: AbortSignal): Promise<RawPost[]>;
  fetch(signal?: AbortSignal): Promise<RawPost[]>;
  normalize(post: RawPost): Signal | null;
}

/** Old server flags are ignored. This process never polls Gmail and never stores a token. */
export function serverGmailEnabled(): boolean {
  return false;
}

export interface SourceStatusInput {
  xEnabled: boolean;
}

export function sourceStatus(input: SourceStatusInput) {
  return [
    { id: "x" as const, sensitivity: "low" as const, enabled: input.xEnabled, privateData: false },
    { id: "gmail" as const, sensitivity: "high" as const, enabled: false, privateData: true },
  ];
}
