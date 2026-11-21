# Contributing

Issues and pull requests are welcome. Vulnerability reports go through [SECURITY.md](SECURITY.md), not through a public issue.

The project is educational. Capability figures stay labeled illustrative. Do not add real RF, jamming, spoofing, live-spectrum capture, or geolocation of a real emitter. Skill-map items are nodes. A node a player has mastered is a lit node.

## Setup

Node `22.23.4`, from `.nvmrc`. pnpm `12.21.0`, from `packageManager`.

```bash
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm -r build
```

`pnpm --filter @an-alq/mcp start` is the MCP server on `127.0.0.1:8787`. `pnpm dev` is the web shell on `127.0.0.1:3000`. `pnpm --filter @an-alq/sim dev` is the standalone trainer on `127.0.0.1:5173`. A dev container is in `.devcontainer/` and forwards those ports. It does not provision secrets. There are none.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/). CI checks the pull request title, which is what a squash merge keeps.

```
feat: add a glossary id
fix: reject an empty tools/call name
chore: bump the lockfile
docs: correct the health path
```

`feat` and `fix` are what release-please will version. See [docs/RELEASE.md](docs/RELEASE.md).

## What belongs where

| Change                        | Where                                                                                   |
| ----------------------------- | --------------------------------------------------------------------------------------- |
| Tool, schema, log, HTTP guard | `apps/mcp/src`, `apps/mcp/api`, `apps/mcp/test`                                         |
| Web shell                     | `apps/web`. No server-only features. Progress stays in `localStorage`.                  |
| Trainer UI and engine         | `packages/sim`                                                                          |
| Emitter library and glossary  | `packages/emitters`                                                                     |
| Sample content                | `apps/mcp/content`, and only if it matches `content/FORMAT.md`                          |
| Relay                         | `packages/relay`. Read the relay section of `docs/THREAT_MODEL.md` before extending it. |

[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) records the layout.

## Privacy invariants

- No new personal field. ZIP stays `^\d{5}$` and optional.
- `logEvent` grows a field only when that field cannot carry a body, a ZIP, or an address.
- The trainer may keep aggregate counts in `localStorage`. It may not post them.
- Error text does not echo the rejected value. The fast-check tests in `test/fuzz.test.ts` lock this for the request validators.

## Review

`CODEOWNERS` requests `@anthonygenovese`. The maintainer merges. Agents do not.
