# Private Package Publishing

## Goal

Publish the private packages from a separate private repository so the public repo can consume them in private environments without storing premium logic here.

Current working package scope:

- `@akrijsama/private-core`
- `@akrijsama/private-registry`

Reason:

- GitHub Packages for npm requires the package scope to match the owner namespace.
- If you later create a `soliddark` GitHub org, you can re-scope the private packages there.

## Recommended repository layout

Use a separate private repository, for example:

```text
solid-dark-private/
  packages/
    private-core/
    private-registry/
  pnpm-workspace.yaml
  package.json
  .github/workflows/publish-private.yml
```

## Package metadata

Use GitHub Packages for scoped private packages:

```json
{
  "name": "@akrijsama/private-core",
  "version": "0.1.1",
  "private": false,
  "publishConfig": {
    "registry": "https://npm.pkg.github.com"
  }
}
```

Repeat the same pattern for `@soliddark/private-registry`.
Repeat the same pattern for `@akrijsama/private-registry`.

## Authentication

In the private repo workflow:

- `GITHUB_TOKEN` is sufficient for publishing to GitHub Packages in the same owner scope in most setups
- otherwise use a PAT with `write:packages`, `read:packages`, and `repo`

In consumers:

- preferred: set `SOLIDDARK_PRIVATE_PACKAGES_TOKEN` with a token that has `read:packages`
- fallback: use the workflow `GITHUB_TOKEN` with `packages: read` if the package access model for your repo allows it
- configure `@akrijsama` to use `https://npm.pkg.github.com`

## Example publishing workflow

```yaml
name: Publish Private Packages

on:
  workflow_dispatch:
  push:
    tags:
      - "private-v*"

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          registry-url: https://npm.pkg.github.com
          scope: "@akrijsama"
      - run: pnpm install --frozen-lockfile
      - run: pnpm -r build
      - run: pnpm --filter @akrijsama/private-core publish --no-git-checks
        env:
          NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      - run: pnpm --filter @akrijsama/private-registry publish --no-git-checks
        env:
          NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Public repo CI injection

The public repo’s [soliddark.yml](/home/akrij/SolidDark/soliddark/.github/workflows/soliddark.yml) now supports private-module injection when these secrets are set:

- `SOLIDDARK_PRIVATE_MODULES=true`
- optional `SOLIDDARK_PRIVATE_PACKAGES_TOKEN=<token with read:packages>`

When enabled, CI:

- authenticates against GitHub Packages
- installs `@akrijsama/private-core` and `@akrijsama/private-registry`
- exports:
  - `SOLIDDARK_PRIVATE_CORE_HOOKS_MODULE`
  - `SOLIDDARK_PRIVATE_REGISTRY_POLICY_MODULE`

If `SOLIDDARK_PRIVATE_PACKAGES_TOKEN` is absent, the workflow falls back to `github.token`. That may still require package access to be granted to the public repository in GitHub’s package settings.

## Local development

For local testing without publishing, point the env vars at filesystem modules:

```bash
export SOLIDDARK_PRIVATE_CORE_HOOKS_MODULE=/home/akrij/SolidDark/private-packages/private-core/dist/index.js
export SOLIDDARK_PRIVATE_REGISTRY_POLICY_MODULE=/home/akrij/SolidDark/private-packages/private-registry/dist/index.js
```
