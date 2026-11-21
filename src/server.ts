import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ErrorCode, GetPromptRequestSchema, McpError } from "@modelcontextprotocol/sdk/types.js";
import {
  CAPABILITIES_RESOURCE_URI,
  EMITTER_LIBRARY_RESOURCE_URI,
  SERVER_INSTRUCTIONS,
  SERVER_NAME,
  SERVER_VERSION,
  ZIP_CHECK_IN_PROMPT,
} from "./config.js";
import { explainTerm, getCapabilities, getCapabilitiesSummary, getEmitterLibrary, getFrontierPicks, getNewsDrop, zipCheckInMessages } from "./services.js";
import {
  emptyArgsSchema,
  explainTermArgsSchema,
  formatIssues,
  frontierArgsSchema,
  newsDropArgsSchema,
  zipCheckInArgsSchema,
} from "./schemas.js";

const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

function jsonText(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
  };
}

function errorText(message: string) {
  return {
    isError: true as const,
    content: [{ type: "text" as const, text: message }],
  };
}

export function createAnAlqServer(): McpServer {
  const server = new McpServer(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION,
      title: "AN-ALQ",
      description: "Illustrative AN-ALQ electronic-warfare information. Read only.",
      websiteUrl: "https://an-alq.com",
    },
    {
      instructions: SERVER_INSTRUCTIONS,
      maxToolInputElements: 16,
    },
  );

  server.registerTool(
    "get_capabilities",
    {
      title: "AN-ALQ capabilities",
      description:
        "Return the public AN-ALQ capability catalog. Every quantitative figure is labeled illustrative. The advanced research division is not open for briefing. Read-only and informational: no sensing, jamming, spoofing, or targeting.",
      inputSchema: emptyArgsSchema,
      annotations: READ_ONLY,
    },
    async () => jsonText(getCapabilities()),
  );

  server.registerTool(
    "get_emitter_library",
    {
      title: "Fictional emitter library",
      description:
        "Return the fictional emitter-archetype catalog used by the AN-ALQ Range Trainer. Names are invented. Frequencies, PRI, PRF, pulse widths, bandwidths, and hop figures are illustrative textbook-style values, not measurements of real systems. Read-only. No sensing, jamming, spoofing, or geolocation is performed.",
      inputSchema: emptyArgsSchema,
      annotations: READ_ONLY,
    },
    async () => jsonText(getEmitterLibrary()),
  );

  server.registerTool(
    "get_news_drop",
    {
      title: "Sample news drop",
      description:
        "Return the sample news drop for a slot: morning, midday, or afternoon. An optional zip must be exactly 5 digits. ZIPs are not logged or stored. Unknown fields are rejected. Content is sample data until the file says otherwise.",
      inputSchema: newsDropArgsSchema,
      annotations: READ_ONLY,
    },
    async (args) => jsonText(getNewsDrop(args)),
  );

  server.registerTool(
    "get_frontier_picks",
    {
      title: "Sample frontier picks",
      description:
        "Return sample frontier picks for a calendar month (YYYY-MM) from the static content store. Missing months are reported, not invented. Read-only.",
      inputSchema: frontierArgsSchema,
      annotations: READ_ONLY,
    },
    async (args) => jsonText(getFrontierPicks(args)),
  );

  server.registerTool(
    "explain_ew_term",
    {
      title: "EW 101 definition",
      description:
        "Define one electronic-warfare term from the local glossary. Ids include rgpo, vgpo, drfm, esm, elint, tdoa, aoa, fhss, dsss, spot_jamming, barrage_jamming, swept_jamming, angle_deception, gnss_spoofing, false_target. Case-insensitive. Definitions only; nothing is simulated or applied.",
      inputSchema: explainTermArgsSchema,
      annotations: READ_ONLY,
    },
    async (args) => {
      const result = explainTerm(args.term);
      if (!result.ok) return errorText(result.message);
      return jsonText(result.body);
    },
  );

  server.registerResource(
    "emitter-library",
    EMITTER_LIBRARY_RESOURCE_URI,
    {
      title: "Fictional emitter library",
      description:
        "Fictional training archetypes for the Range Trainer. Figures are illustrative. Not a library of real systems.",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.toString(),
          mimeType: "application/json",
          text: JSON.stringify(getEmitterLibrary(), null, 2),
        },
      ],
    }),
  );

  server.registerResource(
    "capabilities-summary",
    CAPABILITIES_RESOURCE_URI,
    {
      title: "AN-ALQ capabilities summary",
      description:
        "Shorter capabilities summary. Quantitative figures are illustrative. Advanced research is not open for briefing.",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.toString(),
          mimeType: "application/json",
          text: JSON.stringify(getCapabilitiesSummary(), null, 2),
        },
      ],
    }),
  );

  server.registerPrompt(
    ZIP_CHECK_IN_PROMPT,
    {
      title: "ZIP-only check-in",
      description:
        "Build a check-in that accepts only a 5-digit ZIP. No name, email, phone, street address, or other personal field.",
      argsSchema: {
        zip: zipCheckInArgsSchema.shape.zip.describe(
          "Exactly 5 digits. The only personal field this prompt accepts.",
        ),
      },
    },
    async (args) => zipCheckInMessages(args.zip),
  );

  // registerPrompt wraps a raw shape in a non-strict object, which strips
  // unknown keys. Replace the get handler so extras are rejected instead.
  server.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    if (request.params.name !== ZIP_CHECK_IN_PROMPT) {
      throw new McpError(ErrorCode.InvalidParams, "Unknown prompt");
    }
    const parsed = zipCheckInArgsSchema.safeParse(request.params.arguments ?? {});
    if (!parsed.success) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid arguments for prompt ${ZIP_CHECK_IN_PROMPT}: ${formatIssues(parsed.error)}`,
      );
    }
    return zipCheckInMessages(parsed.data.zip);
  });

  return server;
}
