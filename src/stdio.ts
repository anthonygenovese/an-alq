import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createAnAlqServer } from "./server.js";

const server = createAnAlqServer();
const transport = new StdioServerTransport();
await server.connect(transport);
