import type { IncomingMessage, ServerResponse } from "node:http";
import { SERVER_NAME, SERVER_VERSION } from "../src/config.js";
import { allowedOriginsFromEnv, applyHttpGuards } from "../src/security.js";

export default function handler(req: IncomingMessage, res: ServerResponse): void {
  const decision = applyHttpGuards(req, res, {
    mode: "vercel",
    allowedOrigins: allowedOriginsFromEnv(),
  });
  if (!decision.proceed) return;
  const body = JSON.stringify({ ok: true, name: SERVER_NAME, version: SERVER_VERSION });
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(body);
}
