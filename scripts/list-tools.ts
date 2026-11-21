import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createApp } from "../src/app.js";
import { SERVER_NAME, SERVER_VERSION } from "../src/config.js";

const app = createApp();
const httpServer = app.listen(0, "127.0.0.1");
await once(httpServer, "listening");
const address = httpServer.address() as AddressInfo;
const base = `http://127.0.0.1:${address.port}`;

const client = new Client({ name: "an-alq-smoke", version: SERVER_VERSION });
const transport = new StreamableHTTPClientTransport(new URL(`${base}/mcp`));

try {
  await client.connect(transport);
  const tools = await client.listTools();
  const resources = await client.listResources();
  const prompts = await client.listPrompts();
  const names = tools.tools.map((tool) => tool.name).join(", ");
  const resourceUris = resources.resources.map((resource) => resource.uri).join(", ");
  const promptNames = prompts.prompts.map((prompt) => prompt.name).join(", ");
  console.log(`${SERVER_NAME} ${SERVER_VERSION}`);
  console.log(`tools: ${names}`);
  console.log(`resources: ${resourceUris}`);
  console.log(`prompts: ${promptNames}`);
  if (tools.tools.length < 5 || !tools.tools.some((tool) => tool.name === "get_emitter_library")) {
    throw new Error("expected the fictional emitter library tool");
  }
} finally {
  await client.close().catch(() => undefined);
  httpServer.closeAllConnections?.();
  await new Promise<void>((resolve, reject) => {
    httpServer.close((error) => (error ? reject(error) : resolve()));
  });
}
