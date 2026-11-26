// SPDX-License-Identifier: MIT
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { AddressInfo } from "node:net";
import { createApp } from "../src/app.js";

const EXPECTED = [
  "explain_ew_term",
  "get_capabilities",
  "get_emitter_library",
  "get_frontier_picks",
  "get_news_drop",
];

function inspectorBin(): string {
  const require = createRequire(import.meta.url);
  const pkgPath = require.resolve("@modelcontextprotocol/inspector/package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
    bin: { "mcp-inspector": string };
  };
  return join(dirname(pkgPath), pkg.bin["mcp-inspector"]);
}

function run(
  bin: string,
  args: string[],
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [bin, ...args], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => out.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => err.push(chunk));
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("MCP Inspector timed out"));
    }, 30_000);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        code: code ?? 1,
        stdout: Buffer.concat(out).toString("utf8"),
        stderr: Buffer.concat(err).toString("utf8"),
      });
    });
  });
}

const app = createApp();
const httpServer = app.listen(0, "127.0.0.1");
await once(httpServer, "listening");
const address = httpServer.address() as AddressInfo;
const url = `http://127.0.0.1:${address.port}/mcp`;
const bin = inspectorBin();
const base = [
  "--cli",
  "--transport",
  "http",
  "--server-url",
  url,
  "--format",
  "json",
  "--connect-timeout",
  "10000",
];

try {
  const listed = await run(bin, [...base, "--method", "tools/list"]);
  if (listed.code !== 0) {
    throw new Error(`tools/list exited ${listed.code}\n${listed.stderr}\n${listed.stdout}`);
  }
  const envelope = JSON.parse(listed.stdout) as { result?: { tools?: { name: string }[] } };
  const names = (envelope.result?.tools ?? []).map((tool) => tool.name).sort();
  const missing = EXPECTED.filter((name) => !names.includes(name));
  if (missing.length > 0) {
    throw new Error(`inspector tools/list missing ${missing.join(", ")} from ${names.join(", ")}`);
  }

  const called = await run(bin, [
    ...base,
    "--method",
    "tools/call",
    "--tool-name",
    "get_capabilities",
    "--tool-args-json",
    "{}",
  ]);
  if (called.code !== 0) {
    throw new Error(`tools/call exited ${called.code}\n${called.stderr}\n${called.stdout}`);
  }
  if (!called.stdout.includes("illustrative")) {
    throw new Error("get_capabilities result did not include the illustrative label");
  }
  console.log(`inspector ok: ${names.join(", ")}`);
} finally {
  httpServer.closeAllConnections?.();
  await new Promise<void>((resolve, reject) => {
    httpServer.close((error) => (error ? reject(error) : resolve()));
  });
}
