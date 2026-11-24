# Architecture

AN-ALQ in this repository is a pnpm workspace. The web shell, the MCP server, and the relay demo share the emitter catalog. The relay reads public alerts and does not post.

| Piece              | Runs as                                                | Talks to                                                                              |
| ------------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Web shell          | Next.js in `apps/web`. Vercel project `an-alq-web`.    | The trainer, the skill map, and the relay demo. No call to `/mcp`.                    |
| MCP server         | Node, Express locally, a Vercel function in production | The content files and the in-process catalog. No outbound fetch.                      |
| Range trainer      | `apps/sim`, mounted by the web shell and by Vite       | The emitter package, bundled. No call to `/mcp`.                                      |
| Public alert relay | `apps/relay`, polled by `apps/web`                     | `SignalSource` adapter. No approved source, so the poll does not read. Does not post. |

Capability figures and emitter-library numbers are illustrative. The trainer's waterfall is synthetic. Nothing in this tree is a receiver, recorder, jammer, spoofer, or geolocation system.

## Layout

```
apps/web/                 Next.js shell. /, /range, /map, /relay
apps/mcp/                 MCP server, api/, content/, tests
apps/sim/                 T1 waterfall, skill map, and the trainer engine
apps/sim/scenarios/       Synthetic T1 scenarios. A seed and scripted answers.
apps/sim/src/node/        Node-only reader for those scenario files.
apps/relay/               Public alert relay. `/relay` reads a same-origin snapshot, or demo fixtures
packages/emitters/        Fictional emitter library and glossary
pnpm-workspace.yaml       Workspace root
```

Deployable projects live in `apps/`. `packages/emitters` is the shared catalog. The server and the trainer both depend on it. The web shell depends on the trainer and the relay, and it does not depend on the server.

## MCP request path

```
client
  → Host check (local only; loopback names, or ALLOWED_HOSTS)
  → security headers and CORS
  → JSON parse, 32 KB, strict
  → hash the observed address, check the in-memory window
  → guardRpcBody (no batches, strict tool arguments)
  → one-shot McpServer + stateless streamable HTTP
  → drop the server
```

`GET /health` and `GET /healthz` skip the rate limit. They return the name and version. CORS still applies.

On Vercel the address is the first hop of `x-vercel-forwarded-for`. A client-supplied `x-forwarded-for` is not read. Locally the address is the socket peer. The hash is not logged.

Stdio is a second entry, `src/stdio.ts`. stdout is the protocol. Logs stay on stderr.

## Skill map

The map is `an-alq.skill-map.v1` in `apps/sim/src/engine/skill-map.ts`. Items are nodes. A node whose criterion is met, and whose required nodes are already lit, becomes a lit node.

| Domain                | Tier | Status   | What a lit node would mean                                                                                                                  |
| --------------------- | ---- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| SIGINT classification | T1   | Playable | The player named fictional emitters on the synthetic waterfall.                                                                             |
| Geolocation           | T2   | Partial  | `converging-fix` is a fictional grid cell. `tdoa-lines` is a glossary definition. AOA stays locked. No coordinates and no fix.              |
| Radar response        | T3   | Partial  | `barrage-label` lights from a glossary definition after T1 mastery and an acknowledgment. Spot, RGPO, and VGPO stay locked. No transmitter. |
| Comms disruption      | T3   | Partial  | `comms-fhss` is a glossary definition. DSSS and selectivity stay locked. Nothing is followed.                                               |
| Electronic deception  | T4   | Locked   | Nothing. No spoofing content.                                                                                                               |
| Multi-threat ops      | T5   | Partial  | `collateral-rule` picks the fictional board label for observe only. Time pressure and several traces stay locked.                           |

Evidence is `an-alq.skill-evidence.v1`: attempt counts, correct counts, and summed reaction time, keyed by fictional category and by difficulty (`recruit`, `operator`, `lead`). `loadEvidence` rejects a payload that fails the strict schema and returns an empty record. Extra keys, including anything that looks like an email or a name, are dropped.

The UI writes that record to `localStorage` under the same key. The barrage acknowledgment and definition match are a second browser record, `an-alq.skill-acknowledgment.v1`, with two booleans and no technique fields. The fictional grid uses `an-alq.tier-evidence.v1` and `an-alq.tier-acknowledgment.v1`. Each loader drops a document that fails its strict schema. The MCP server never sees these records.

A participation ring is reserved (`participation-glow-ring`, `computedBy: "later-module"`). This build passes a null intensity and draws nothing for it. The ring is how a later module would show participation. The map is what the player demonstrated.

## Trainer tiers

Defined in `apps/sim/src/engine/tiers.ts`.

| Id  | Name                | Status                                                                                          |
| --- | ------------------- | ----------------------------------------------------------------------------------------------- |
| T1  | Spectral classify   | Playable. Two-second window. Seeded PRNG. Illustrative frequency, PRI, and SNR.                 |
| T2  | Geolocation fix     | Fictional grid cell and a TDOA definition. AOA stays locked. No coordinates and no fix.         |
| T3  | Response technique  | Barrage and FHSS are glossary definitions. Spot, RGPO, VGPO, DSSS, and selectivity stay locked. |
| T4  | Deception decisions | Locked. No spoofing content.                                                                    |
| T5  | Multi-threat        | Collateral is a fictional board label. The other T5 nodes stay locked.                          |

`pnpm dev` serves the shell at `127.0.0.1:3000`. `pnpm --filter @an-alq/sim dev` still serves the Vite trainer at `127.0.0.1:5173`. CI typechecks each package and runs `pnpm -r build`. The trainer bundle is not the MCP function.

## Content store

`content/FORMAT.md` is the contract. Unknown keys fail the process on boot, which is how a future job is stopped from adding a ZIP column. `sample: true` travels with `label: "example"`. Reviewed copy would use `sample: false` and `label: "editorial"`. v0.1 ships examples only.

## Configuration

[`apps/mcp/.env.example`](../apps/mcp/.env.example) is the full list for the server. No secret is required to boot. `apps/mcp/vercel.json` rewrites `/mcp`, `/health`, and `/healthz`, sets edge headers, and caps the MCP function at 10 seconds. CSP on the edge is scoped to the API paths. `apps/web/next.config.ts` sets the shell's headers, and `apps/web/vercel.json` repeats them.

The web shell polls only from `GET /api/cron/relay`. The schedule in `apps/web/vercel.json` is `0 13 * * *` (once a day). `RELAY_SOURCE` is blank. `APPROVED_RELAY_SOURCES` is empty, so the cron does not read. A read also requires `livePollingAllowed`: live mode, the filtered stream closed, and production unless `RELAY_ALLOW_PREVIEW=1`. The handler would read `X_BEARER_TOKEN` from the environment and store `an-alq:relay:snapshot` in Upstash Redis only after an owner-approved source is named. The live source is TBD. A former Nixle adapter is in the tree and is not on the approved list. `GET /api/relay/snapshot` is same-origin and says no live source is configured. `connect-src` stays `'self'`. Preview deploys stay on demo fixtures unless `RELAY_ALLOW_PREVIEW=1`. The filtered stream stays closed.

## What is intentionally absent

- CI attachment of the hostname. `mcp.an-alq.com` is live on the `an-alq-mcp` project.
- OAuth. It shows up only if a ZIP is stored.
- AOA, and any T2 node that would compute a real fix.
- DSSS, selectivity, spot, RGPO, and VGPO.
- All of T4. Those nodes are spoofing and attack choices.
- Time pressure and several traces.
- Any code path that transmits, records live spectrum, or computes a real fix.
