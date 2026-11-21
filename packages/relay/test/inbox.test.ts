import { describe, expect, it } from "vitest";
import { hamming, simhash } from "../src/fingerprint.js";
import { htmlToText } from "../src/gmail/parse.js";
import { OfflineStubGeocoder } from "../src/geo.js";
import { INBOX_CAP, TOO_LATE, nixleSenderQuery, scanInboxForAlert } from "../src/gmail/inbox.js";

const ALERT = "id:1000001";
const geocoder = new OfflineStubGeocoder();

function rawMessage(alertId: string, date = "Thu, 15 Jan 2026 15:00:00 +0000"): string {
  return [
    `Date: ${date}`,
    "From: alerts@nixle.com",
    "To: hidden@example.com",
    "Subject: South Brunswick PD: Traffic advisory",
    "DKIM-Signature: v=1; a=rsa-sha256; d=nixle.com; s=selector2; h=from:to:subject:date;",
    "",
    "South Brunswick PD: Traffic advisory. Route 1 southbound closed at Finnegans Lane due to a disabled vehicle. Expect delays.",
    `https://local.nixle.com/alert/${alertId}`,
  ].join("\r\n");
}

function b64url(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function callsOf(fetchImpl: typeof fetch): string[] {
  return (fetchImpl as unknown as { urls: string[] }).urls;
}

describe("Nixle-only recency window", () => {
  it("asks Gmail for five inbox messages from the Nixle senders and does not fetch anything else", async () => {
    const urls: string[] = [];
    const fetchImpl = async (input: RequestInfo | URL) => {
      const url = String(input);
      urls.push(url);
      if (url.includes("/messages?")) {
        expect(url).toContain("labelIds=INBOX");
        expect(url).toContain(`maxResults=${INBOX_CAP}`);
        expect(decodeURIComponent(url).replaceAll("+", " ")).toContain(
          "q=from:(nixle.com OR nixle.us)",
        );
        return json({ messages: [{ id: "n1" }, { id: "n2" }] });
      }
      expect(url).not.toContain("promo");
      expect(url).not.toContain("format=metadata");
      expect(url).toContain("format=raw");
      const id = url.includes("/n1") ? "1000001" : "1000099";
      return json({ raw: b64url(rawMessage(id)) });
    };
    (fetchImpl as unknown as { urls: string[] }).urls = urls;
    const scan = await scanInboxForAlert("token-stays-here", ALERT, geocoder, { fetchImpl });
    expect(scan.status).toBe("match");
    if (scan.status === "match") {
      expect(scan.extract.nixleKey).toBe(ALERT);
      expect(scan.dkimCoversDate).toBe(true);
      expect(scan.provenDate).toBe("2026-01-15T15:00:00.000Z");
      expect(JSON.stringify(scan)).not.toContain("hidden@example.com");
      expect(JSON.stringify(scan)).not.toContain("token-stays-here");
    }
    expect(callsOf(fetchImpl).some((url) => url.includes("promo"))).toBe(false);
  });

  it("ranks only the five Nixle ids Gmail returned", async () => {
    const fetchImpl = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/messages?")) {
        return json({ messages: ["a", "b", "c", "d", "e"].map((id) => ({ id })) });
      }
      const id = url.match(/messages\/([^?]+)/)?.[1] ?? "";
      const alertId = id === "e" ? "1000001" : `9${id}`;
      return json({ raw: b64url(rawMessage(alertId)) });
    };
    const fifth = await scanInboxForAlert("t", ALERT, geocoder, { fetchImpl });
    expect(fifth.status).toBe("match");

    const missing = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/messages?"))
        return json({ messages: ["a", "b", "c", "d", "e"].map((id) => ({ id })) });
      return json({ raw: b64url(rawMessage("2000002")) });
    };
    const late = await scanInboxForAlert("t", ALERT, geocoder, { fetchImpl: missing });
    expect(late).toEqual({ status: "too_late" });
    expect(TOO_LATE).toBe("no longer in your latest 5 Nixle alerts");
  });

  it("falls back to From lines only, and never fetches a non-Nixle body", async () => {
    const seen: string[] = [];
    const order = [
      "promo",
      "github",
      "nix-1",
      "promo-2",
      "nix-2",
      "nix-3",
      "nix-4",
      "nix-5",
      "nix-6",
    ];
    const fetchImpl = async (input: RequestInfo | URL) => {
      const url = String(input);
      seen.push(url);
      if (url.includes("q=")) return new Response("no query", { status: 400 });
      if (url.includes("/messages?")) return json({ messages: order.map((id) => ({ id })) });
      const id = decodeURIComponent(url.match(/messages\/([^?]+)/)?.[1] ?? "");
      if (url.includes("format=metadata")) {
        expect(url).toContain("metadataHeaders=From");
        expect(url).not.toContain("Subject");
        const from = id.startsWith("nix")
          ? "Alerts <alerts@nixle.com>"
          : "GitHub <notify@github.com>";
        return json({ payload: { headers: [{ name: "From", value: from }] } });
      }
      expect(id.startsWith("nix")).toBe(true);
      expect(id).not.toBe("nix-6");
      expect(url).toContain("format=raw");
      return json({ raw: b64url(rawMessage(id === "nix-5" ? "1000001" : "300")) });
    };
    const scan = await scanInboxForAlert("t", ALERT, geocoder, { fetchImpl });
    expect(scan.status).toBe("match");
    const rawOrFull = seen.filter(
      (url) => url.includes("format=raw") || url.includes("format=full"),
    );
    expect(rawOrFull.every((url) => url.includes("/nix-"))).toBe(true);
    expect(rawOrFull.some((url) => url.includes("nix-6"))).toBe(false);
    expect(seen.some((url) => url.includes("/promo") && url.includes("format=raw"))).toBe(false);
    expect(seen.some((url) => url.includes("/github") && url.includes("format=metadata"))).toBe(
      true,
    );
  });
});

describe("html and fingerprint", () => {
  it("decodes an entity once and strips tags", () => {
    expect(htmlToText("<p>A &amp;lt; B</p>")).toBe("A &lt; B");
    expect(htmlToText("Route&nbsp;1")).toBe("Route 1");
  });

  it("hashes identical text to a zero distance", () => {
    const hash = simhash(["route", "closed", "lane"]);
    expect(hamming(hash, hash)).toBe(0);
  });
});

describe("sender query", () => {
  it("builds the DKIM-domain sender list and drops unsafe tokens", () => {
    expect(nixleSenderQuery(["nixle.com", "nixle.us"])).toBe("from:(nixle.com OR nixle.us)");
    expect(nixleSenderQuery(["nixle.com", "bad token"])).toBe("from:(nixle.com)");
  });
});

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
