# SolidDark

SolidDark is a seed-stage trust layer for software diligence. This repository now ships a monorepo MVP that separates the open `risk-passport.json` spec from the proprietary verification network so the trust wedge can harden without forcing a later refactor.

Every artifact includes these disclaimers:

- Not legal advice. For information purposes only.
- No guarantee of security. This report may be incomplete.

SolidDark does not provide representation and does not create an attorney-client relationship.

## What ships in this MVP

- Open spec package for `risk-passport.json`
- Local CLI for scan, signing, continuity, verification, and vendor packet export
- Registry service for countersignatures, tiered trust receipts, revocation, buyer-facing verification pages, and benchmark percentiles
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

To run the local registry for local development only:

```bash
pnpm --filter @soliddark/cli exec soliddark registry dev
pnpm --filter @soliddark/cli exec soliddark registry login --api-key soliddark-dev-key --url http://127.0.0.1:4010
pnpm --filter @soliddark/cli exec soliddark publish ./.soliddark/demo/risk-passport.json --bench-opt-in
pnpm --filter @soliddark/cli exec soliddark registry status
pnpm --filter @soliddark/cli exec soliddark verify ./.soliddark/demo/risk-passport.json
```

`soliddark-dev-key` is a local-only default provided by `soliddark registry dev`. Production and shared deployments must set `SOLIDDARK_REGISTRY_API_KEY` explicitly.

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

## Trust tiers

- `baseline`: a registry receipt exists, but no managed review claim is implied.
- `reviewed`: reserved for stronger policy gates or managed review flows.
- `verified`: the strongest trust tier and the one that should anchor buyer-facing claims.

The public baseline policy issues `baseline` receipts. Private policy modules can deny issuance or elevate the tier without changing the public spec or CLI contract.

## Privacy defaults

- Publish uploads counts and hashes only.
- No file paths, dependency names, or code snippets are sent to the registry.
- Benchmark ingestion is opt-in.
- CI writes `ci-runtime.json` so skipped premium or publish paths are recorded as `UNKNOWN` with a reason.
- See [docs/PRIVACY.md](docs/PRIVACY.md).

## Documentation

- [docs/DEFENSIBILITY.md](docs/DEFENSIBILITY.md)
- [docs/PRIVACY.md](docs/PRIVACY.md)
- [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md)
- [docs/PUBLIC_PRIVATE_AUDIT.md](docs/PUBLIC_PRIVATE_AUDIT.md)
- [docs/PRIVATE_MODULES.md](docs/PRIVATE_MODULES.md)
- [docs/PRIVATE_PUBLISHING.md](docs/PRIVATE_PUBLISHING.md)

## Private extension points

This repo now supports replacing monetizable logic without changing the public spec or CLI contract.

- `SOLIDDARK_PRIVATE_CORE_HOOKS_MODULE`
  Optional module that can provide a private enricher and private risk overlay.
- `SOLIDDARK_PRIVATE_REGISTRY_POLICY_MODULE`
  Optional module that can provide a private issuance policy for the registry.

If either env var is set and the module cannot be loaded, the failure is explicit:

- scan records `UNKNOWN` for private-core load failures
- registry issuance returns an explicit error instead of silently falling back

## Test commands

```bash
pnpm build:packages
pnpm test
```

## Current limits

- Dependency parsing is intentionally limited to Node and Python in v0.
- Registry trust is local-dev grade unless you provision production keys and deployment.
- The existing Next.js application in this repo remains present, but the defensibility MVP is implemented in the workspace packages listed above.
