// SPDX-License-Identifier: MIT
import { runRelayPoll } from "@an-alq/relay/live";

export async function GET(request: Request): Promise<Response> {
  try {
    const result = await runRelayPoll({
      env: process.env,
      authorization: request.headers.get("authorization"),
    });
    return Response.json(result.body, { status: result.status });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
