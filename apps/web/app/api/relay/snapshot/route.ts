import {
  configuredRelaySource,
  demoSnapshot,
  kvFromEnv,
  readPublicSnapshot,
} from "@an-alq/relay/live";

const NO_SOURCE = "No live source configured";

export async function GET(): Promise<Response> {
  const source = configuredRelaySource(process.env);
  if (!source) {
    return Response.json({
      ...demoSnapshot(Date.now()),
      source: "none",
      notice: NO_SOURCE,
    });
  }
  try {
    const snapshot = await readPublicSnapshot(kvFromEnv(process.env));
    return Response.json({ ...snapshot, source, notice: null });
  } catch {
    return Response.json({ ...demoSnapshot(Date.now()), source, notice: null });
  }
}
