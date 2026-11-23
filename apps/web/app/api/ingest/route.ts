import { handleIngest } from "@an-alq/relay/live";

export async function POST(request: Request): Promise<Response> {
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  try {
    const result = await handleIngest({
      env: process.env,
      authorization: request.headers.get("authorization"),
      body,
    });
    return Response.json(result.body, { status: result.status });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
