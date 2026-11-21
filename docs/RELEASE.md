# Releases

Versions follow semver. Commits follow [Conventional Commits](https://www.conventionalcommits.org/). `feat` opens a minor bump while the version is 0.x (`bump-minor-pre-major`). `fix` opens a patch. `chore` and `docs` do not bump.

[release-please](https://github.com/googleapis/release-please) watches `main`. The manifest is [`.release-please-manifest.json`](../.release-please-manifest.json). A release PR updates the root `package.json`, `apps/mcp/package.json`, and `CHANGELOG.md`. Merging it tags `vX.Y.Z` and the Release workflow then:

1. Packs `@an-alq/mcp` with `pnpm pack --ignore-scripts`.
2. Writes a CycloneDX SBOM of that package's required dependencies with `cdxgen`.
3. Attests build provenance for the tarball.
4. Attests the SBOM against that tarball.
5. Uploads `sbom.cdx.json` to the GitHub release.

The packages are `"private": true`. Nothing is published to npm.

Dev dependencies, including the trainer toolchain, are covered by `pnpm audit --audit-level=high`, `pnpm audit signatures`, and osv-scanner on `pnpm-lock.yaml` on every pull request. They are omitted from the release SBOM because they are not what the function runs.

## Signed tags

release-please tags through the GitHub API. Those tags are not GPG-signed, and this repository does not put a signing key in Actions.

The owner signs tags locally, with GPG or SSH:

```bash
git tag -s vX.Y.Z <commit>
git push origin vX.Y.Z
git verify-tag vX.Y.Z
```

SSH signing is `gpg.format=ssh` and `user.signingkey` pointed at a public key that is already on the GitHub account. The private key stays on the owner's machine.

To require signatures, add a repository ruleset on `v*` with "Require signed commits". Do that after the key is enrolled. A failing CI check today would reject release-please's unsigned tags, so verification is an owner control until that ruleset exists. CI will not grow a `git verify-tag` step before the public key is a known value.

## What a release is not

A release does not deploy `mcp.an-alq.com` and does not deploy the web shell. Deployment is a separate owner action with the variables in `apps/mcp/.env.example` and no new secrets.
