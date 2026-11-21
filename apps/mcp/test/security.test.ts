import { describe, expect, it } from "vitest";
import type { IncomingMessage } from "node:http";
import { clientAddress } from "../src/client-address.js";
import { logEvent } from "../src/log.js";
import { canonicalOrigin, originDecision, parseOriginList } from "../src/security.js";
import { captureConsole } from "./console.js";

function request(headers: IncomingMessage["headers"], remoteAddress: string): IncomingMessage {
  return {
    headers,
    socket: { remoteAddress },
  } as IncomingMessage;
}

describe("clientAddress", () => {
  it("ignores a client-supplied x-forwarded-for on Vercel", () => {
    const req = request({ "x-forwarded-for": "203.0.113.10" }, "10.0.0.8");
    expect(clientAddress(req, "vercel")).toBe("10.0.0.8");
    expect(clientAddress(req, "local")).toBe("10.0.0.8");
  });

  it("uses the platform header and only its first hop", () => {
    const req = request({ "x-vercel-forwarded-for": "203.0.113.9, 10.0.0.8" }, "10.0.0.8");
    expect(clientAddress(req, "vercel")).toBe("203.0.113.9");
  });
});

describe("origin policy", () => {
  it("drops a wildcard and keeps only canonical origins", () => {
    expect(parseOriginList(undefined)).toEqual([]);
    expect(parseOriginList(" *, https://mcp.an-alq.com/path , not a url ")).toEqual([]);
    expect(parseOriginList("https://mcp.an-alq.com")).toEqual(["https://mcp.an-alq.com"]);
    expect(canonicalOrigin("http://localhost:6274/")).toBe("http://localhost:6274");
    expect(canonicalOrigin("http://user:pass@localhost:6274")).toBeUndefined();
  });

  it("allows loopback only in local mode and never a lookalike host", () => {
    const local = { mode: "local" as const, allowedOrigins: [] };
    const vercel = { mode: "vercel" as const, allowedOrigins: [] };
    expect(originDecision(undefined, local)).toBe("absent");
    expect(originDecision("http://127.0.0.1:6274", local)).toBe("allow");
    expect(originDecision("http://localhost:5173", local)).toBe("allow");
    expect(originDecision("https://localhost:5173", local)).toBe("deny");
    expect(originDecision("http://localhost.evil.example", local)).toBe("deny");
    expect(originDecision("http://127.0.0.1.evil.example", local)).toBe("deny");
    expect(originDecision("http://127.0.0.1:6274", vercel)).toBe("deny");
    expect(
      originDecision("https://mcp.an-alq.com", {
        ...vercel,
        allowedOrigins: ["https://mcp.an-alq.com"],
      }),
    ).toBe("allow");
  });
});

describe("logEvent", () => {
  it("writes an allowlisted JSON line and drops everything else", () => {
    const captured = captureConsole();
    logEvent("bad_request", {
      status: 400,
      code: "origin",
      rid: "0123456789abcdef",
      method: "tools/call",
      zip: "01945",
      email: "a@b.c",
    } as never);
    logEvent("mcp_error", { code: "01945", method: "get_news_drop", rid: "not-hex" });
    const lines = captured.text().trim().split("\n");
    expect(lines).toHaveLength(2);
    const first = JSON.parse(lines[0] ?? "{}") as Record<string, unknown>;
    expect(Object.keys(first).sort()).toEqual(["code", "event", "method", "rid", "status", "ts"]);
    expect(first.zip).toBeUndefined();
    expect(captured.text()).not.toContain("01945");
    expect(captured.text()).not.toContain("a@b.c");
    expect(captured.text()).not.toContain("get_news_drop");
    const second = JSON.parse(lines[1] ?? "{}") as Record<string, unknown>;
    expect(second.code).toBeUndefined();
    expect(second.method).toBeUndefined();
    expect(second.rid).toBeUndefined();
    captured.restore();
  });
});
