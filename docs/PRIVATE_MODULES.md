# Private Modules

## Purpose

This repository now supports optional private modules so the monetizable logic can be removed from the public repo without breaking the open spec, CLI, or verification API.

## Supported extension points

### Private core hooks

Env var:

- `SOLIDDARK_PRIVATE_CORE_HOOKS_MODULE`

Expected exports:

- `privateCoreHooks`
- or a default export with the same shape

Supported hook methods:

- `createEnricher(): Enricher`
- `overlayRiskModel(passport): Promise<{ status, risk_score?, enrichment?, next_actions?, notes?, unknown_reason?, error_reason? }>`

Behavior:

- if unset and no private package exists, the public baseline stays active
- if set and load fails, scan records `UNKNOWN` with the explicit reason

### Private registry policy

Env var:

- `SOLIDDARK_PRIVATE_REGISTRY_POLICY_MODULE`

Expected exports:

- `registryIssuancePolicy`
- or a default export with the same shape

Supported hook method:

- `beforeIssue({ payload }): Promise<{ status, allow, issuer?, notes?, unknown_reason?, error_reason? }>`

Behavior:

- if unset and no private package exists, the public baseline issuance policy stays active
- if set and load fails, issuance fails explicitly
- if the policy denies issuance, the registry returns a clear error and does not countersign

## Recommended next step

Move the monetizable implementations into a separate private repository and publish them as private packages. Keep only the interfaces and public fallbacks in this repo.

## Public baseline after privatization prep

The public repo now keeps only baseline behavior by default:

- no premium enrichment is auto-applied during scan
- private overlays must be provided through `SOLIDDARK_PRIVATE_CORE_HOOKS_MODULE`
- private registry issuance policy must be provided through `SOLIDDARK_PRIVATE_REGISTRY_POLICY_MODULE`

This is intentional. The open repo preserves compatibility and trust semantics, while the monetizable behavior moves behind install-time private modules.
