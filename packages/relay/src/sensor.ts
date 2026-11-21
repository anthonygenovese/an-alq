import type { AlertExtract } from "./extract.js";
import { ingestRequest } from "./ingest.js";

export const TOKEN_LIFETIME_MS = 60 * 60 * 1000;

export type DisarmReason = "manual" | "expiry" | "close";

export interface SensorSnapshot {
  armed: boolean;
  remainingMs: number;
  consentOpen: boolean;
}

export interface InboxSensor {
  snapshot(now: number): SensorSnapshot;
  openConsent(): void;
  cancelConsent(): void;
  arm(token: string, now: number, expiresInSec?: number): void;
  disarm(reason: DisarmReason, now: number): void;
  tick(now: number): void;
  /** Present only while armed. Never place this value in an ingest body. */
  accessToken(): string | null;
  ingestBody(extract: AlertExtract): ReturnType<typeof ingestRequest>;
}

/**
 * Browser inbox sensor. The access token lives in this closure.
 * It is not written to localStorage, a cookie, or the ingest body.
 * Arming is per page load. Closing, expiry, or disarm revokes and clears it.
 */
export function createInboxSensor(revoke: (token: string) => void): InboxSensor {
  let token: string | null = null;
  let expiresAt = 0;
  let consentOpen = false;

  const clear = (now: number, reason: DisarmReason) => {
    if (token) revoke(token);
    token = null;
    expiresAt = 0;
    consentOpen = false;
    void now;
    void reason;
  };

  return {
    snapshot(now: number): SensorSnapshot {
      const remainingMs = token ? Math.max(0, expiresAt - now) : 0;
      return { armed: token !== null && remainingMs > 0, remainingMs, consentOpen };
    },
    openConsent() {
      if (token) return;
      consentOpen = true;
    },
    cancelConsent() {
      consentOpen = false;
    },
    arm(next: string, now: number, expiresInSec = 3600) {
      if (!next) return;
      const requested = Math.max(1, expiresInSec) * 1000;
      const life = Math.min(TOKEN_LIFETIME_MS, requested);
      token = next;
      expiresAt = now + life;
      consentOpen = false;
    },
    disarm(_reason, now) {
      clear(now, _reason);
    },
    tick(now: number) {
      if (token && now >= expiresAt) clear(now, "expiry");
    },
    accessToken() {
      return token;
    },
    ingestBody(extract: AlertExtract) {
      return ingestRequest(extract);
    },
  };
}

export interface LeaveTarget {
  addEventListener(type: string, handler: () => void): void;
  removeEventListener(type: string, handler: () => void): void;
}

/** pagehide and beforeunload both disarm. The token is revoked and dropped. */
export function bindDisarmOnLeave(target: LeaveTarget, disarm: () => void): () => void {
  const onHide = () => disarm();
  target.addEventListener("pagehide", onHide);
  target.addEventListener("beforeunload", onHide);
  return () => {
    target.removeEventListener("pagehide", onHide);
    target.removeEventListener("beforeunload", onHide);
  };
}

export interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
}

export interface TokenClient {
  requestAccessToken(options: { prompt: "consent" }): void;
}

export interface GoogleIdentity {
  accounts: {
    oauth2: {
      initTokenClient(config: {
        client_id: string;
        scope: string;
        callback: (response: TokenResponse) => void;
      }): TokenClient;
      revoke(token: string, done?: () => void): void;
    };
  };
}

export const GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

/** Popup token client. No refresh token is requested or stored. */
export function requestBrowserToken(
  google: GoogleIdentity,
  clientId: string,
  onToken: (token: string, expiresInSec: number) => void,
): void {
  const client = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: GMAIL_READONLY_SCOPE,
    callback: (response) => {
      if (!response.access_token || response.error) return;
      onToken(response.access_token, response.expires_in ?? 3600);
    },
  });
  client.requestAccessToken({ prompt: "consent" });
}

export function revokeBrowserToken(google: GoogleIdentity | null, token: string): void {
  google?.accounts.oauth2.revoke(token);
}
