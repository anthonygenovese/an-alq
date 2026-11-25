# Security

AN-ALQ is an educational MCP server and a synthetic trainer. It does not handle accounts. It does still take untrusted JSON, and the supply-chain controls around it are part of the product.

## Reporting

Use [private vulnerability reporting](https://github.com/anthonygenovese/an-alq/security/advisories/new).

Do not open a public issue, and do not post a proof of concept that includes a live endpoint, a credential, or a request for operational RF. Email is not a channel for this repository. There is no bounty.

| Step                        | Target                                                                                 |
| --------------------------- | -------------------------------------------------------------------------------------- |
| Acknowledge                 | 3 business days                                                                        |
| Fix or a written mitigation | 90 days                                                                                |
| Public disclosure           | After the fix, or at 90 days if we have not shipped one, coordinated with the reporter |

## Scope

In scope:

- The MCP server, its schemas, its logs, and the Vercel handlers
- The trainer engine and UI, including what `localStorage` retains
- GitHub Actions workflows, pinned dependencies, and release attestations
- The relay's credential handling, once that module exists

Out of scope:

- Illustrative numbers and sample editorial copy
- Availability of an-alq.com, which is a separate site
- Social engineering of the maintainer
- Physical attacks
- Findings that only reproduce when a secret that was never shipped is present
- Requests to add jamming, spoofing, live-spectrum, or real-geolocation code

Good-faith research that stays inside this repository, does not destroy data, and does not transmit RF is welcome. There is no other user's data to access.

## Supported versions

| Version         | Supported |
| --------------- | --------- |
| 0.1.x on `main` | Yes       |
| Anything else   | No        |

## Secrets

This tree has no API keys. `.env.example` lists bind addresses and allowlists only.

- Enable GitHub secret scanning and push protection in the repository settings. A workflow file cannot turn those on.
- CI runs gitleaks 8.30.1 over the full git history, using [`.gitleaks.toml`](.gitleaks.toml). The binary is the MIT-licensed CLI, checksum-pinned. The commercial gitleaks Action is not used. The only allowlist entry is the localStorage schema id `an-alq.skill-evidence.v1`, which the generic-api-key rule misreads.
- Dependabot covers the pnpm lockfile and GitHub Actions. Actions are pinned to commit SHAs.
- `pnpm audit --audit-level=high`, `pnpm audit signatures`, and osv-scanner run on every pull request.
- If a secret reaches git, rotate it first, then purge the history. A force-push does not un-leak a credential that was fetched.
- If the X bearer token, the relay's Redis store, or any X Content is exposed or suspected exposed, rotate the affected secrets first, then notify X immediately, as required by the X Developer Agreement, section III.G (https://docs.x.com/developer-terms/agreement).

## Supply chain

CodeQL (`security-and-quality`) and OpenSSF Scorecard run from `.github/workflows/`. Scorecard publishes to the [OpenSSF API](https://scorecard.dev/viewer/?uri=github.com/anthonygenovese/an-alq) for the badge on the README. A release attaches a CycloneDX SBOM and a build-provenance attestation. Signed tags are described in [docs/RELEASE.md](docs/RELEASE.md).

The threat model is [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md).
