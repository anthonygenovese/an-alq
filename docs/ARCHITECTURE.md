# Architecture

AN-ALQ in this repository is two processes that share a TypeScript catalog, plus a relay that is specified and not built.

| Piece            | Runs as                                                | Talks to                                                         |
| ---------------- | ------------------------------------------------------ | ---------------------------------------------------------------- |
| MCP server       | Node, Express locally, a Vercel function in production | The content files and the in-process catalog. No outbound fetch. |
| Range trainer    | Vite dev server, or a static build in `dist/sim`       | The same modules, bundled. No call to `/mcp`.                    |
| Nixle-to-X relay | Not present                                            | Would read public alerts and post them. See the threat model.    |

Capability figures and emitter-library numbers are illustrative. The trainer's waterfall is synthetic. Nothing in this tree is a receiver, recorder, jammer, spoofer, or geolocation system.

## Layout today

```
api/            Vercel handlers for /api/mcp and /api/health
src/            MCP server, catalog, and the trainer engine
src/sim/        Generator, scoring, skill map. Imported by the UI and tested by vitest
sim/            Vite UI. Skill map and the T1 range
content/        Sample news drops and frontier picks
test/           vitest, including fast-check properties on the validators
```

The server stays at the repository root. The trainer stays in `sim/`. Both arrived as merged pull requests. Moving them in the same change as the supply-chain work would collide with a relay branch that expects this tree.

## Target layout

When the relay exists and a rename is the only thing in the pull request:

```
apps/sim/                 current sim/
packages/mcp-server/      current root server, api/, content/, src/ except src/sim
packages/relay/           Nixle-to-X relay
packages/trainer-engine/  current src/sim, if the UI and the server should both depend on it
```

Until that pull request, do not add a root `workspaces` field. An empty workspace glob fails `npm ci`, and a half-moved tree is worse than a documented one.

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

The map is `an-alq.skill-map.v1` in `src/sim/skill-map.ts`. Items are nodes. A node whose criterion is met, and whose required nodes are already lit, becomes a lit node.

| Domain                | Tier | Status   | What a lit node would mean                                      |
| --------------------- | ---- | -------- | --------------------------------------------------------------- |
| SIGINT classification | T1   | Playable | The player named fictional emitters on the synthetic waterfall. |
| Geolocation           | T2   | Locked   | Nothing. The criterion is unavailable. No fix is computed.      |
| Radar response        | T3   | Locked   | Nothing. Labels point at the glossary. No transmitter.          |
| Comms disruption      | T3   | Locked   | Nothing. Recognition labels only.                               |
| Electronic deception  | T4   | Locked   | Nothing. No signal is produced.                                 |
| Multi-threat ops      | T5   | Locked   | Nothing. The range still shows one unknown.                     |

Evidence is `an-alq.skill-evidence.v1`: attempt counts, correct counts, and summed reaction time, keyed by fictional category and by difficulty (`recruit`, `operator`, `lead`). `loadEvidence` rejects a payload that fails the strict schema and returns an empty record. Extra keys, including anything that looks like an email or a name, are dropped.

The UI writes that record to `localStorage` under the same key. The MCP server never sees it.

A participation ring is reserved (`participation-glow-ring`, `computedBy: "later-module"`). This build passes a null intensity and draws nothing for it. The ring is how a later module would show participation. The map is what the player demonstrated.

## Trainer tiers

Defined in `src/sim/tiers.ts`.

| Id  | Name                | Status                                                                          |
| --- | ------------------- | ------------------------------------------------------------------------------- |
| T1  | Spectral classify   | Playable. Two-second window. Seeded PRNG. Illustrative frequency, PRI, and SNR. |
| T2  | Geolocation fix     | Planned. Hooks only. No real coordinates.                                       |
| T3  | Response technique  | Planned. Training labels. No transmitter.                                       |
| T4  | Deception decisions | Planned. No spoofing.                                                           |
| T5  | Multi-threat        | Planned.                                                                        |

`npm run sim` serves the UI at `127.0.0.1:5173`. `npm run build:sim` emits `dist/sim`. CI typechecks `sim/tsconfig.json` and builds that bundle. The bundle is not the Vercel function.

## Content store

`content/FORMAT.md` is the contract. Unknown keys fail the process on boot, which is how a future job is stopped from adding a ZIP column. `sample: true` travels with `label: "example"`. Reviewed copy would use `sample: false` and `label: "editorial"`. v0.1 ships examples only.

## Configuration

[`.env.example`](../.env.example) is the full list. No secret is required to boot. `vercel.json` rewrites `/mcp`, `/health`, and `/healthz`, sets edge headers, and caps the MCP function at 10 seconds. CSP on the edge is scoped to the API paths.

## What is intentionally absent

- A workspace move.
- A deployed hostname.
- OAuth. It shows up only if a ZIP is stored.
- Playable T2–T5.
- Any code path that transmits, records live spectrum, or computes a real fix.
