# Public vs Private Audit

## Goal

The product should remain easy to adopt while preserving a trust wedge that compounds over time. That means the document format should be public, while the network effects and higher-value enrichment layers remain controlled.

## Should stay public

### `packages/spec`

Keep this public and independently licensed.

Reason:

- adoption of the passport format is the flywheel
- buyers benefit from a stable, inspectable schema
- open schema reduces fear of lock-in while increasing attachment to the verification network

What should remain public here:

- `risk-passport.json` schema
- registry publish payload shape
- registry verification envelope shape
- example fixtures and schema docs

### Canonicalization and local verification primitives

Current location:

- `packages/core/src/canonical.ts`
- `packages/core/src/crypto.ts`

Reason:

- local signing and verification should be inspectable to build trust
- open deterministic serialization avoids disputes over what was signed

### Minimal SDK contract

Current location:

- `packages/sdk`

Reason:

- customers and partners should be able to verify registry records without reverse engineering a private client
- public SDK support increases buyer confidence and ecosystem integration

Public surface should stay narrow:

- issue, verify, revoke, benchmark-ingest, percentile lookup request formats
- response parsing and signature verification helpers

### Basic CLI artifact generation

Current location:

- `packages/cli`
- `packages/core/src/markdown.ts`
- `packages/core/src/continuity.ts`

Reason:

- the passport should be easy to generate locally
- public artifact generation increases distribution and CI lock-in

## Good candidates to move private later

### Enrichment logic behind `Enricher`

Current location:

- `packages/core/src/enrichment.ts`

Reason:

- this is already the cleanest extraction seam
- percentile interpretation, trust weighting, and scoring adjustments are differentiators

Recommended future move:

- keep the `Enricher` interface public
- replace the default implementation with a closed package or remote service

### Registry-side scoring, trust heuristics, and issuer policy

Current location:

- `packages/registry/src/server.ts`

Reason:

- countersigning policy is where the trust network becomes harder to replicate
- issuance rules, fraud controls, revocation policy, and benchmark quality checks should become proprietary

Recommended future move:

- keep the verification API public
- keep the signing policy, abuse controls, and quality gates private

### Benchmark corpus and percentile calibration

Current location:

- registry database records and bench endpoints

Reason:

- the raw benchmark corpus compounds with usage
- percentiles become more valuable as the network grows
- DIY copies do not get the same historical population

Recommended future move:

- continue exposing percentile results
- do not expose the underlying dataset or derivation details beyond high-level methodology

### Risk drivers and advanced scoring models

Current location:

- `packages/core/src/scan.ts`

Reason:

- the current heuristic is transparent and acceptable for MVP
- long term, the most monetizable layer is not the parser but the quality of prioritization and buyer-facing interpretation

Recommended future move:

- keep baseline scoring transparent
- add premium issuer-side or managed enrichment scoring privately

## Should not become private if trust matters

- the schema itself
- signature formats
- verification envelope fields
- revocation status semantics
- privacy/upload rules
- the fact that `UNKNOWN` must be explicit

If these become opaque, buyer trust erodes and adoption slows.

## Near-term commercialization recommendation

Public:

- `packages/spec`
- verification format docs
- local generation and signing
- minimal SDK

Source-available or mixed:

- CLI implementation
- baseline scanning heuristics

Private later:

- advanced enrichment modules
- registry issuance policy
- benchmark corpus quality controls
- premium buyer exports and procurement workflow integrations

## Current repo readiness

The codebase is already structured correctly for this strategy:

- open spec is isolated
- enrichment has an interface boundary
- registry is a separate package
- CLI talks to the registry through the SDK instead of internal imports

That means future privatization can happen without forcing a schema rewrite or a user-facing CLI redesign.
