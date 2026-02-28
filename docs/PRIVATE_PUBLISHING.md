# Private Package Publishing

## Goal

Publish `@soliddark/private-core` and `@soliddark/private-registry` from a separate private repository so the public repo can consume them in private environments without storing premium logic here.

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
  "name": "@soliddark/private-core",
  "version": "0.1.1",
  "private": false,
  "publishConfig": {
    "registry": "https://npm.pkg.github.com"
  }
}
```

Repeat the same pattern for `@soliddark/private-registry`.

## Authentication

In the private repo workflow:

- `GITHUB_TOKEN` is sufficient for publishing to GitHub Packages in the same owner scope in most setups
- otherwise use a PAT with `write:packages`, `read:packages`, and `repo`

In consumers:

- set `SOLIDDARK_PRIVATE_PACKAGES_TOKEN`
- configure `@soliddark` to use `https://npm.pkg.github.com`

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
          scope: "@soliddark"
      - run: pnpm install --frozen-lockfile
      - run: pnpm -r build
      - run: pnpm --filter @soliddark/private-core publish --no-git-checks
        env:
          NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      - run: pnpm --filter @soliddark/private-registry publish --no-git-checks
        env:
          NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Public repo CI injection

The public repo’s [soliddark.yml](/home/akrij/SolidDark/soliddark/.github/workflows/soliddark.yml) now supports private-module injection when these secrets are set:

- `SOLIDDARK_PRIVATE_MODULES=true`
- `SOLIDDARK_PRIVATE_PACKAGES_TOKEN=<token>`

When enabled, CI:

- authenticates against GitHub Packages
- installs `@soliddark/private-core` and `@soliddark/private-registry`
- exports:
  - `SOLIDDARK_PRIVATE_CORE_HOOKS_MODULE`
  - `SOLIDDARK_PRIVATE_REGISTRY_POLICY_MODULE`

## Local development

For local testing without publishing, point the env vars at filesystem modules:

```bash
export SOLIDDARK_PRIVATE_CORE_HOOKS_MODULE=/home/akrij/SolidDark/private-packages/private-core/dist/index.js
export SOLIDDARK_PRIVATE_REGISTRY_POLICY_MODULE=/home/akrij/SolidDark/private-packages/private-registry/dist/index.js
```
