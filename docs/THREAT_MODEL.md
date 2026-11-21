# Threat model

Scope is the code in this repository and one designed component that is not implemented. The product is educational. Quantitative figures are illustrative. There is no real RF, jamming, spoofing, or geolocation.

Reviewed: November 2026, against the MCP server v0.1 and the T1 range trainer.

## Assets

| Asset                    | Why it matters                                                                                                  |
| ------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Catalog integrity        | Callers treat tool output as the project's public statement. A tampered file would put words in that statement. |
| The no-echo rule         | Error strings and logs must not repeat a ZIP, an address, a header, or a body.                                  |
| Rate-limit fairness      | One caller should not pin the process. The bucket must not be forgeable.                                        |
| On-device skill evidence | Aggregate counts in the browser. Low sensitivity, still not for a server.                                       |
| Future relay credential  | Not in the repo. Called out so it is not invented casually.                                                     |

## Actors

| Actor               | Can                                                                             |
| ------------------- | ------------------------------------------------------------------------------- |
| MCP client          | Send JSON-RPC to `/mcp` or over stdio.                                          |
| Browser player      | Run the trainer locally. Read and write their own `localStorage`.               |
| Hostile HTTP client | Send a large body, a forged forwarded-for header, a hostile `Host` or `Origin`. |
| Maintainer          | Merge to `main`, cut a release, hold the only production credentials.           |
| Future relay        | Not built. Would hold a posting credential and read public alerts.              |

## Assumptions

- The Vercel function is reached through Vercel, which sets `x-vercel-forwarded-for` and strips a client-supplied copy of that header.
- The local server binds to loopback unless `HOST` is changed on purpose.
- The content files in git are the content files the process reads. There is no admin upload.
- The trainer bundle does not embed a secret. `npm run build:sim` only compiles the catalog and the UI.

## STRIDE — MCP endpoint

| Threat                 | Property                                                                               | What the code does                                                                                                                                                                                                                                                        | Residual                                                                                                                                                                                                                                          |
| ---------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Spoofing               | A caller pretends to be another caller, or a browser pretends to be an allowed origin. | No accounts, so there is no user to impersonate. CORS reflects an origin only when it is on `ALLOWED_ORIGINS`. Local mode also allows loopback HTTP origins, checked with the URL parser, not a prefix. `*` is ignored. `Host` is checked against loopback names locally. | On Vercel the host check is off because preview hostnames move. The platform routes the host. A stolen `ALLOWED_ORIGINS` entry is a browser exception, not an identity.                                                                           |
| Tampering              | A body or a content file is altered in transit or on disk.                             | TLS is the platform's job. The process rejects unknown JSON keys, batches, and argument objects over eight keys. Content files fail closed on schema mismatch. Responses set `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`.                             | Anyone who can write the content files can change the catalog. That is a commit, and it is reviewed.                                                                                                                                              |
| Repudiation            | A caller denies a request.                                                             | Logs are structured and contain a random `rid` and, when it is one of a fixed set, the RPC method. They do not contain the body. There is no user identity to bind the `rid` to.                                                                                          | This is a public read API. Non-repudiation of a read is not a goal. The `rid` is for the operator, not for a court.                                                                                                                               |
| Information disclosure | A ZIP, address, or header leaks in an error or a log.                                  | Schema messages do not interpolate the submitted value. `logEvent` copies four fields and drops the rest. Codes must match `^[A-Za-z][A-Za-z0-9_]{0,31}$`, which rejects a 5-digit ZIP. The rate-limit key is a hash and is not logged. ETag is disabled.                 | The tool response for a news drop includes the ZIP the caller just sent, in the response to that caller. It is not written anywhere else. A proxy in front of the process could still log the raw request. Do not put one there that logs bodies. |
| Denial of service      | A large body, a hot loop, or a bucket flood.                                           | JSON limit is 32 KB. Rate limit is 60 per minute per hashed address, with a 5,000-key cap and expiry. The Vercel function is capped at 10 seconds. Each request builds a server and drops it. Health checks are not counted.                                              | The limit is per process. A cold start resets it. Many source addresses still cost CPU up to the platform's concurrency cap. That is accepted for a read API.                                                                                     |
| Elevation of privilege | A tool gains a side effect.                                                            | Every tool is annotated read-only, idempotent, and closed-world. There is no shell, no outbound fetch, and no write to the content store. The research division tool returns a refusal.                                                                                   | A future tool that stores a ZIP or calls the network is a new trust boundary and needs its own review, including OAuth if anything identifying is kept.                                                                                           |

## STRIDE — range trainer

The UI is a local page. It imports the engine. It does not open a socket to the MCP server.

| Threat                 | Property                                    | What the code does                                                                                                                                                                      | Residual                                                                                                                                                                                                                                                        |
| ---------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Spoofing               | A fake catalog is shown as the project's.   | The catalog is compiled into the bundle from this repo.                                                                                                                                 | A tampered checkout is a tampered checkout.                                                                                                                                                                                                                     |
| Tampering              | Skill evidence is edited in `localStorage`. | The record is the player's own scores. `loadEvidence` drops a document that fails the strict schema. Editing it changes only which nodes light on that browser.                         | No server leaderboard exists to poison.                                                                                                                                                                                                                         |
| Repudiation            | —                                           | Not applicable. Scores never leave the browser.                                                                                                                                         | —                                                                                                                                                                                                                                                               |
| Information disclosure | The evidence record leaks.                  | The record is counts and milliseconds by fictional category and difficulty. No name, no ZIP, no account. The page does not `fetch`. There is no `innerHTML` assignment of catalog text. | XSS in a future dependency could read that record. The damage is the counts. A production host for `dist/sim` should add a CSP. This repo does not deploy the bundle, and a meta CSP would break the Vite dev server, so it is not hardcoded into `index.html`. |
| Denial of service      | A seed hangs the generator.                 | Rounds are pure functions of a seed and a difficulty. The classify window is two seconds of animation, not a solver.                                                                    | A hostile seed cannot reach another player's machine.                                                                                                                                                                                                           |
| Elevation              | The trainer becomes a transmitter.          | T2–T5 nodes are locked and their criterion is `unavailable`. The generator draws a spectrogram texture. It does not open a radio, a socket to hardware, or a file of IQ samples.        | Adding a playable T3 that emits a waveform would leave this model. Don't, without a new review that still forbids real RF.                                                                                                                                      |

## STRIDE — Nixle-to-X relay (not implemented)

This section is a constraint on a future module. It is not a design you can build from line by line, and it is not an invitation to collect alerts beyond what a public feed already shows.

The relay, if it is written, reads public alert text and posts it to X. It does not subscribe anyone, store a phone number, or geolocate a person.

| Threat                 | Constraint before any code is merged                                                                                                                                                                                 |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Spoofing               | Verify the source of each alert. Do not accept a body posted by an anonymous caller as if it were the feed.                                                                                                          |
| Tampering              | Treat the feed as untrusted input. Escape it for the destination API. Do not let alert text become a shell argument or a log of someone else's contact data.                                                         |
| Repudiation            | Keep an idempotency key so a retry does not double-post. The key is the alert id, not a subscriber id.                                                                                                               |
| Information disclosure | Public alert text only. No subscriber list, no phone, no email, no precise location of a person. Logs follow the same allowlist as the MCP server. The posting credential is a platform secret, never a file in git. |
| Denial of service      | Bound the poll, bound the post rate, and drop duplicates. A burst in the feed must not become a burst of posts.                                                                                                      |
| Elevation              | The credential can post and nothing else. Scope it. Rotate it by replacing the secret, not by committing a new one.                                                                                                  |

Decay: posting state is the set of alert ids already sent. It expires. It is not a archive of who received an alert, because the relay does not know that.

## Privacy summary

| Store                  | What is kept                              | How it ends                                                                  |
| ---------------------- | ----------------------------------------- | ---------------------------------------------------------------------------- |
| MCP process memory     | Hashed rate-limit keys and timestamps     | Window expiry, key cap, process exit, Vercel cold start                      |
| MCP disk               | Nothing                                   | —                                                                            |
| MCP logs               | Allowlisted fields, stderr                | The platform's log retention, which should be short. No body is in the line. |
| Browser `localStorage` | Aggregate trainer counts                  | The player clears site data. The server never receives the record.           |
| Git                    | Sample content, fictional catalog, source | Review. No secrets. gitleaks runs on the full history in CI.                 |

Anonymity is the absence of an identifier, not a hash of one that we then store. The address hash exists only inside the rate-limit map and is gone with the window.

## Reporting

[SECURITY.md](../SECURITY.md). Do not open a public issue for a vulnerability. A report that asks for operational RF, jamming, or spoofing code is out of scope and will be closed.
