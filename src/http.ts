import { DEFAULT_PORT } from "./config.js";
import { createApp } from "./app.js";
import { logEvent } from "./log.js";
import { allowedOriginsFromEnv } from "./security.js";

function readPort(): number {
  const raw = process.env.PORT ?? String(DEFAULT_PORT);
  if (!/^\d+$/.test(raw)) return DEFAULT_PORT;
  const port = Number(raw);
  if (port < 1 || port > 65535) return DEFAULT_PORT;
  return port;
}

const host = process.env.HOST ?? "127.0.0.1";
const port = readPort();
const allowedHosts = process.env.ALLOWED_HOSTS?.split(",")
  .map((item) => item.trim())
  .filter((item) => item.length > 0);
const allowedOrigins = allowedOriginsFromEnv();

const app = createApp({
  mode: "local",
  ...(allowedHosts && allowedHosts.length > 0 ? { allowedHosts } : {}),
  ...(allowedOrigins.length > 0 ? { allowedOrigins } : {}),
});

const server = app.listen(port, host, () => {
  console.error(`AN-ALQ MCP listening on http://${host}:${port}/mcp`);
});

server.on("error", (error: NodeJS.ErrnoException) => {
  logEvent("listen_error", { code: error.code ?? "error" });
  process.exit(1);
});

function shutdown(): void {
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
