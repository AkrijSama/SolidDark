# SolidDark

SolidDark is a seed-stage trust layer for software diligence. This repository now ships a monorepo MVP that separates the open `risk-passport.json` spec from the proprietary verification network so the trust wedge can harden without forcing a later refactor.

Every artifact includes these disclaimers:

- Not legal advice. For information purposes only.
- No guarantee of security. This report may be incomplete.

SolidDark does not provide representation and does not create an attorney-client relationship.

## What ships in this MVP

- Open spec package for `risk-passport.json`
- Local CLI for scan, signing, continuity, verification, and vendor packet export
- Registry service for countersignatures, revocation, and benchmark percentiles
- SDK used by the CLI for registry communication
- GitHub Actions example for release-attached diligence artifacts

## Monorepo layout

```text
packages/
  spec/      open schema, JSON schema export, example fixture, separate license
  core/      canonical JSON, hashing, signing, scanners, enrichment interface
  cli/       soliddark executable
  registry/  trust registry service
  sdk/       registry client
docs/
fixtures/
LICENSES/
```

`packages/spec` is kept independently publishable and separately licensed.

## Quickstart

```bash
pnpm install
pnpm build:packages

pnpm --filter @soliddark/cli exec soliddark keys generate
pnpm --filter @soliddark/cli exec soliddark scan fixtures/node-simple --offline --out ./.soliddark/demo
pnpm --filter @soliddark/cli exec soliddark continuity fixtures/node-simple --out ./.soliddark/demo
pnpm --filter @soliddark/cli exec soliddark export vendor-packet \
  --passport ./.soliddark/demo/risk-passport.json \
  --continuity ./.soliddark/demo/continuity-pack \
  --out ./.soliddark/vendor-packet
```

To run the local registry:

```bash
pnpm --filter @soliddark/registry exec tsx src/index.ts
pnpm --filter @soliddark/cli exec soliddark registry login --api-key soliddark-dev-key --url http://127.0.0.1:4010
pnpm --filter @soliddark/cli exec soliddark publish ./.soliddark/demo/risk-passport.json --bench-opt-in
pnpm --filter @soliddark/cli exec soliddark verify ./.soliddark/demo/risk-passport.json
```

## CLI surface

```bash
soliddark init
soliddark keys generate
soliddark keys status
soliddark scan <path> [--out <dir>] [--offline] [--include-paths]
soliddark continuity <path> [--out <dir>]
soliddark registry login --api-key <key> [--url <registry>]
soliddark registry dev [--host <host>] [--port <port>] [--data-dir <dir>]
soliddark registry status
soliddark publish <risk-passport.json> [--project-label <label>] [--bench-opt-in]
soliddark verify <risk-passport.json> [--sig <file>] [--registry-envelope <file>]
soliddark export vendor-packet --passport <file> --continuity <dir> [--out <dir|zip>]
```

## Offline behavior

- Offline scan still produces artifacts and exits `0` if the core artifact is produced.
- Vulnerability lookup becomes `UNKNOWN` with an explicit reason.
- Registry verification never reports verified when the registry cannot be reached. It returns `UNKNOWN` with the reason instead.
- No skipped step fails silently. Unknowns and errors are aggregated into the passport and `scan-manifest.json`.

## Privacy defaults

- Publish uploads counts and hashes only.
- No file paths, dependency names, or code snippets are sent to the registry.
- Benchmark ingestion is opt-in.
- See [docs/PRIVACY.md](/home/akrij/SolidDark/soliddark/docs/PRIVACY.md).

## Documentation

- [docs/DEFENSIBILITY.md](/home/akrij/SolidDark/soliddark/docs/DEFENSIBILITY.md)
- [docs/PRIVACY.md](/home/akrij/SolidDark/soliddark/docs/PRIVACY.md)
- [docs/THREAT_MODEL.md](/home/akrij/SolidDark/soliddark/docs/THREAT_MODEL.md)

## Test commands

```bash
pnpm build:packages
pnpm test
```

## Current limits

- Dependency parsing is intentionally limited to Node and Python in v0.
- Registry trust is local-dev grade unless you provision production keys and deployment.
- The existing Next.js application in this repo remains present, but the defensibility MVP is implemented in the workspace packages listed above.
