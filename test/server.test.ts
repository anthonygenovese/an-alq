import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it } from "vitest";
import { CAPABILITIES_RESOURCE_URI, ZIP_CHECK_IN_PROMPT } from "../src/config.js";
import { createAnAlqServer } from "../src/server.js";
import { captureConsole } from "./console.js";

const PLANTED = "01945";

async function connect() {
  const server = createAnAlqServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "an-alq-test", version: "0.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, server };
}

describe("MCP server", () => {
  const consoles: Array<ReturnType<typeof captureConsole>> = [];

  afterEach(() => {
    for (const captured of consoles.splice(0)) captured.restore();
  });

  it("lists the four read-only tools, the summary resource, and the check-in prompt", async () => {
    const { client, server } = await connect();
    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name).sort()).toEqual([
      "explain_ew_term",
      "get_capabilities",
      "get_frontier_picks",
      "get_news_drop",
    ]);
    const news = tools.tools.find((tool) => tool.name === "get_news_drop");
    expect(news?.inputSchema).toMatchObject({ additionalProperties: false });
    expect(news?.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false });
    const resources = await client.listResources();
    expect(resources.resources.map((resource) => resource.uri)).toContain(CAPABILITIES_RESOURCE_URI);
    const prompts = await client.listPrompts();
    expect(prompts.prompts.map((prompt) => prompt.name)).toContain(ZIP_CHECK_IN_PROMPT);
    await client.close();
    await server.close();
  });

  it("calls each tool and reads the resource", async () => {
    const { client, server } = await connect();
    const capabilities = await client.callTool({ name: "get_capabilities", arguments: {} });
    expect(JSON.stringify(capabilities)).toContain("illustrative");
    const news = await client.callTool({
      name: "get_news_drop",
      arguments: { slot: "midday" },
    });
    expect(JSON.stringify(news)).toContain("example");
    const picks = await client.callTool({
      name: "get_frontier_picks",
      arguments: { month: "2026-11" },
    });
    expect(JSON.stringify(picks)).toContain("2026-11");
    const term = await client.callTool({
      name: "explain_ew_term",
      arguments: { term: "DRFM" },
    });
    expect(JSON.stringify(term)).toContain("Digital radio frequency memory");
    const resource = await client.readResource({ uri: CAPABILITIES_RESOURCE_URI });
    const body = resource.contents[0];
    expect(body && "text" in body ? body.text : "").toContain(
      "not yet available for general briefing",
    );
    await client.close();
    await server.close();
  });

  it("rejects unknown fields and a bad ZIP without logging the planted value", async () => {
    const captured = captureConsole();
    consoles.push(captured);
    const { client, server } = await connect();
    const unknown = await client.callTool({
      name: "get_news_drop",
      arguments: { slot: "morning", zip: "00501", name: PLANTED },
    });
    expect(unknown.isError).toBe(true);
    expect(JSON.stringify(unknown)).not.toContain(PLANTED);

    const badZip = await client.callTool({
      name: "get_news_drop",
      arguments: { slot: "morning", zip: "1234" },
    });
    expect(badZip.isError).toBe(true);
    expect(JSON.stringify(badZip)).not.toContain("1234");

    await expect(
      client.getPrompt({
        name: ZIP_CHECK_IN_PROMPT,
        arguments: { zip: "00501", note: PLANTED },
      }),
    ).rejects.toThrow(/Unrecognized key/);

    const prompt = await client.getPrompt({
      name: ZIP_CHECK_IN_PROMPT,
      arguments: { zip: "00501" },
    });
    expect(JSON.stringify(prompt)).toContain("00501");
    expect(JSON.stringify(prompt)).toContain("Do not ask for a name");

    expect(captured.text()).not.toContain(PLANTED);
    expect(captured.text()).not.toContain("00501");
    await client.close();
    await server.close();
  });
});
