import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SignalBoard } from "../src/board.js";
import { DEFAULT_DECAY } from "../src/decay.js";
import { postFromExtract } from "../src/extract.js";
import { OfflineStubGeocoder } from "../src/geo.js";
import { INBOX_CAP, scanInboxForAlert } from "../src/gmail/inbox.js";
import { parsePost } from "../src/parse.js";
import { pulseFromActivity } from "../src/pulse.js";
import { LIVE_BOARD } from "../src/runtime.js";
import { makeNullifier } from "../src/vote/nullifier.js";
import { WindowVoteLimit, submitVote } from "../src/vote/submit.js";
import { ScaffoldProofVerifier } from "../src/vote/verifier.js";

const ALERT_KEY = "id:1000042";
const ALERT_URL = "https://local.nixle.com/alert/1000042";
const TO_ADDRESS = "resident@example.com";
const FROM_ADDRESS = "alerts@nixle.com";
const MESSAGE_ID = "illustrative-sanitized-1000042";
const GMAIL_ID = "gmail-id-sanitized";
const TOKEN = "ya29.sanitized-token";

const eml = readFileSync(new URL("./fixtures/nixle-alert.eml", import.meta.url), "utf8");
const geocoder = new OfflineStubGeocoder();

describe("recorded Nixle email", () => {
  it("parses a sanitized raw message into one decaying pulse and a fallback vote", async () => {
    const fetchImpl = mockGmail(eml);
    const scan = await scanInboxForAlert(TOKEN, ALERT_KEY, geocoder, { fetchImpl });
    expect(scan.status).toBe("match");
    if (scan.status !== "match") return;
    expect(scan.dkimCoversDate).toBe(true);
    expect(scan.extract.sourceKey).toBe(ALERT_KEY);
    expect(scan.extract.sourceUrl).toBe(ALERT_URL);
    expect(scan.extract.agency).toBe("South Brunswick PD");
    expect(scan.extract.category).toBe("traffic");
    expect(scan.provenDate).toBe("2026-01-15T15:00:00.000Z");
    expect(JSON.stringify(scan.extract)).not.toContain(TO_ADDRESS);
    expect(JSON.stringify(scan.extract)).not.toContain(FROM_ADDRESS);
    expect(JSON.stringify(scan.extract)).not.toContain(MESSAGE_ID);

    const observedMs = Date.parse(scan.extract.observedAt);
    const candidate = parsePost(postFromExtract(scan.extract), geocoder);
    expect(candidate).not.toBeNull();
    if (!candidate) return;
    expect(candidate.sourceKey).toBe(ALERT_KEY);
    expect(candidate.location).toEqual({
      lat: 40.39,
      lon: -74.54,
      precision: "centroid",
      label: "South Brunswick, NJ",
    });

    const board = new SignalBoard(LIVE_BOARD);
    const first = board.ingest(candidate, observedMs);
    expect(first.accepted).toBe(true);
    const opened = board.signals(observedMs);
    expect(opened).toHaveLength(1);
    const signal = opened[0];
    expect(signal?.sourceKey).toBe(ALERT_KEY);
    expect(signal?.pulse).toEqual(pulseFromActivity(1));
    expect(signal?.receptions).toBe(0);
    const published = JSON.stringify(opened);
    expect(published).not.toContain(TO_ADDRESS);
    expect(published).not.toContain(FROM_ADDRESS);
    expect(published).not.toContain(MESSAGE_ID);
    expect(published).not.toContain(GMAIL_ID);
    expect(published).not.toContain(TOKEN);

    const second = board.ingest(
      { ...candidate, postMaterial: "second-relay", accountMaterial: null },
      observedMs,
    );
    expect(second.accepted).toBe(true);
    expect(second.signalId).toBe(first.signalId);
    const merged = board.signals(observedMs);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.pulse).toEqual(pulseFromActivity(2));
    expect(merged[0]?.pulse.periodMs).toBeLessThan(signal?.pulse.periodMs ?? 0);
    expect(merged[0]?.pulse.opacity).toBeGreaterThan(signal?.pulse.opacity ?? 1);
    expect(board.relayCountInWindow(observedMs)).toBe(2);

    const repeat = board.ingest(candidate, observedMs);
    expect(repeat.accepted).toBe(false);
    expect(repeat.signalId).toBe(first.signalId);
    expect(board.signals(observedMs)).toHaveLength(1);
    expect(board.signals(observedMs)[0]?.pulse).toEqual(pulseFromActivity(2));

    const verifier = new ScaffoldProofVerifier();
    const nullifier = makeNullifier(ALERT_KEY, "device-secret");
    const proof = {
      alertKey: ALERT_KEY,
      nullifier,
      provenDate: scan.provenDate,
      dkimDomain: "nixle.com",
      selector: "selector2",
      bytes: "",
    };
    expect(verifier.verify(proof)).toEqual({ ok: false, reason: "zk_verifier_not_deployed" });
    const voteNow = observedMs + 60_000;
    const limiter = new WindowVoteLimit(4, 20, 60 * 60_000);
    const accepted = submitVote(
      board,
      { alertKey: ALERT_KEY, nullifier, provenDate: proof.provenDate, proof },
      voteNow,
      verifier,
      limiter,
    );
    expect(accepted).toEqual({ ok: true, assurance: "fallback", signalId: first.signalId });
    expect(board.signals(voteNow)[0]?.receptions).toBe(1);
    expect(board.signals(voteNow)[0]?.receptionMark).toBe("fallback");
    const duplicate = submitVote(
      board,
      { alertKey: ALERT_KEY, nullifier, provenDate: proof.provenDate, proof },
      voteNow,
      verifier,
      limiter,
    );
    expect(duplicate).toEqual({ ok: false, reason: "duplicate" });
    expect(board.nullifierCount()).toBe(1);

    const faded = board.signals(observedMs + DEFAULT_DECAY.halfLifeMs);
    expect(faded).toHaveLength(1);
    expect(faded[0]?.pulse.periodMs).toBeGreaterThan(merged[0]?.pulse.periodMs ?? 0);
    expect(faded[0]?.pulse.opacity).toBeLessThan(merged[0]?.pulse.opacity ?? 1);
    expect(faded[0]?.pulse).toEqual(pulseFromActivity(1));

    const dropped = board.signals(observedMs + DEFAULT_DECAY.inactivityTtlMs);
    expect(dropped).toHaveLength(0);
    expect(board.size).toBe(0);
    expect(board.nullifierCount()).toBe(0);
  });
});

function mockGmail(raw: string): typeof fetch {
  const fetchImpl = async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/messages?")) {
      expect(url).toContain("labelIds=INBOX");
      expect(url).toContain(`maxResults=${INBOX_CAP}`);
      expect(decodeURIComponent(url).replaceAll("+", " ")).toContain(
        "q=from:(nixle.com OR nixle.us)",
      );
      return json({
        messages: ["a", "b", GMAIL_ID, "d", "e"].map((id) => ({ id })),
      });
    }
    expect(url).toContain("format=raw");
    const id = url.match(/messages\/([^?]+)/)?.[1] ?? "";
    const body = id === GMAIL_ID ? raw : otherNixle();
    return json({ id, raw: Buffer.from(body).toString("base64url") });
  };
  return fetchImpl;
}

function otherNixle(): string {
  return [
    "Date: Thu, 15 Jan 2026 14:00:00 +0000",
    "From: Nixle Alerts <alerts@nixle.com>",
    "Subject: Office notice",
    "DKIM-Signature: v=1; a=rsa-sha256; d=nixle.com; s=selector2; h=from:to:subject:date;",
    "",
    "The desk is open today. This notice has no alert link.",
  ].join("\r\n");
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
