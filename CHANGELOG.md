# Changelog

Release pull requests are opened by release-please from conventional commits on `main`. See [docs/RELEASE.md](docs/RELEASE.md).

## [0.7.0](https://github.com/anthonygenovese/an-alq/compare/an-alq-v0.6.0...an-alq-v0.7.0) (2026-11-25)


### Features

* **relay:** source switch, off by default ([#36](https://github.com/anthonygenovese/an-alq/issues/36)) ([19a884a](https://github.com/anthonygenovese/an-alq/commit/19a884ab93ff864f64560b04ad065b3f5db7d08c))
* **web:** add cookieless analytics and a privacy page ([#42](https://github.com/anthonygenovese/an-alq/issues/42)) ([1b46080](https://github.com/anthonygenovese/an-alq/commit/1b460805766752b348975deb3a3ae189e163d539))

## [0.6.0](https://github.com/anthonygenovese/an-alq/compare/an-alq-v0.5.0...an-alq-v0.6.0) (2026-11-22)


### Features

* **sim:** add definition nodes for TDOA, FHSS, and collateral ([#25](https://github.com/anthonygenovese/an-alq/issues/25)) ([b423acb](https://github.com/anthonygenovese/an-alq/commit/b423acb899bfd200ba258395566ae37b8f1348f1))
* **web:** add a light theme toggle on the home page ([#30](https://github.com/anthonygenovese/an-alq/issues/30)) ([9e2984b](https://github.com/anthonygenovese/an-alq/commit/9e2984b57f22f5ee668f8133316c4aee78cf7a6c))


### Bug Fixes

* **mcp:** report package version from package.json on /healthz ([#28](https://github.com/anthonygenovese/an-alq/issues/28)) ([77fa1d9](https://github.com/anthonygenovese/an-alq/commit/77fa1d921d61a26f1825e52e2a317adbda275412))

## [0.5.0](https://github.com/anthonygenovese/an-alq/compare/an-alq-v0.4.0...an-alq-v0.5.0) (2026-11-22)


### Features

* **sim:** add tier engine and first T2 geolocation-grid node ([#23](https://github.com/anthonygenovese/an-alq/issues/23)) ([d7d7ebd](https://github.com/anthonygenovese/an-alq/commit/d7d7ebd2af86750601e313f85086b8c0c01c877b))

## [0.4.0](https://github.com/anthonygenovese/an-alq/compare/an-alq-v0.3.0...an-alq-v0.4.0) (2026-11-22)


### Features

* light the barrage node from a glossary definition ([#19](https://github.com/anthonygenovese/an-alq/issues/19)) ([391e1a3](https://github.com/anthonygenovese/an-alq/commit/391e1a3c3d70036ec23761a009bfbc99ab9add5b))
* **web:** add tiers page with lit nodes and next-node hint ([#22](https://github.com/anthonygenovese/an-alq/issues/22)) ([9caa98f](https://github.com/anthonygenovese/an-alq/commit/9caa98f7db4fb16ca29af9150c5efaeea7b6c565))

## [0.3.0](https://github.com/anthonygenovese/an-alq/compare/an-alq-v0.2.0...an-alq-v0.3.0) (2026-11-22)


### Features

* **sim:** add scenario file loader and example replay ([#15](https://github.com/anthonygenovese/an-alq/issues/15)) ([994bffa](https://github.com/anthonygenovese/an-alq/commit/994bffac0949879d4cdaf9baf3dde3e844e76bd0))

## [0.2.0](https://github.com/anthonygenovese/an-alq/compare/an-alq-v0.1.0...an-alq-v0.2.0) (2026-11-22)

### Features

- count only Nixle mail toward a receipt ([#7](https://github.com/anthonygenovese/an-alq/issues/7)) ([6202c80](https://github.com/anthonygenovese/an-alq/commit/6202c80a17c206b66a5f560428a36611097a0b5a))
- harden the MCP server and cover the trainer in CI ([#3](https://github.com/anthonygenovese/an-alq/issues/3)) ([4412778](https://github.com/anthonygenovese/an-alq/commit/44127787dc02179540d36fef0d0ba9aaf2f6134e))
- turn the repo into a pnpm workspace with a Next.js shell ([dcf75fb](https://github.com/anthonygenovese/an-alq/commit/dcf75fbb8064ea2504523300e5398ea82eade95c))
- turn the repo into a pnpm workspace with a Next.js shell ([930ff00](https://github.com/anthonygenovese/an-alq/commit/930ff00ea9bae43807d8fb66e3e4cdea84373ea6))

### Bug Fixes

- clear the osv-scanner findings in the pnpm lockfile ([97ee217](https://github.com/anthonygenovese/an-alq/commit/97ee217cb0463b32447c42ba9882343851d23254))
- **lint:** set tsconfigRootDir for ESLint 10 ([f2b7550](https://github.com/anthonygenovese/an-alq/commit/f2b75500a71f7a86608b12b649504d114d44bf8e))
- **lint:** set tsconfigRootDir for ESLint 10 (supersedes [#5](https://github.com/anthonygenovese/an-alq/issues/5)) ([56f7604](https://github.com/anthonygenovese/an-alq/commit/56f76047a5ae15e6011169d42947878167767533))
- **security:** resolve CodeQL alerts in relay Gmail parser and fingerprint ([#8](https://github.com/anthonygenovese/an-alq/issues/8)) ([4654185](https://github.com/anthonygenovese/an-alq/commit/4654185679f0cc51b21513162b98e186745221b9))

## 0.1.0 - 2026-11-21

### Features

- Read-only AN-ALQ MCP server. Streamable HTTP and stdio. Illustrative capability figures. Sample content store.
- Tier 1 range trainer and skill map. Nodes light from on-device evidence. T2 through T5 stay locked.
