// SPDX-License-Identifier: MIT
import {
  configuredRelaySource,
  demoSnapshot,
  hostsForSource,
  kvFromEnv,
  readPublicSnapshot,
} from "@an-alq/relay/live";

const NO_SOURCE = "No live source configured";

export async function GET(): Promise<Response> {
  const source = configuredRelaySource(process.env);
  const allowedHosts = hostsForSource(source);
  if (!source) {
    return Response.json({
      ...demoSnapshot(Date.now()),
      source: "none",
      notice: NO_SOURCE,
      allowedHosts,
    });
  }
  try {
    const snapshot = await readPublicSnapshot(kvFromEnv(process.env));
    return Response.json({ ...snapshot, source, notice: null, allowedHosts });
  } catch {
    return Response.json({ ...demoSnapshot(Date.now()), source, notice: null, allowedHosts });
  }
}
