import { demoSnapshot, kvFromEnv, readPublicSnapshot } from "@an-alq/relay/live";

export async function GET(): Promise<Response> {
  try {
    const snapshot = await readPublicSnapshot(kvFromEnv(process.env));
    return Response.json(snapshot);
  } catch {
    return Response.json(demoSnapshot(Date.now()));
  }
}
