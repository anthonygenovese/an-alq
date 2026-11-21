import type { IncomingMessage, ServerResponse } from "node:http";
import { SERVER_NAME, SERVER_VERSION } from "../src/config.js";

export default function handler(_req: IncomingMessage, res: ServerResponse): void {
  const body = JSON.stringify({ ok: true, name: SERVER_NAME, version: SERVER_VERSION });
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(body);
}
