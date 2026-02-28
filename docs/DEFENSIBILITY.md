# Defensibility

## Core claim

SolidDark is defensible because the open artifact is not the moat. The moat is the verification network that buyers can independently trust.

## Open spec vs proprietary network

- Open spec:
  `risk-passport.json` is public and intended for broad adoption. A vendor can generate the document without asking SolidDark for permission.
- Proprietary verification:
  `SolidDark Verified` requires a registry countersignature, timestamped issuance record, pinned public key, trust tier assignment, and revocation status check.
- Workflow lock-in:
  CI can attach passports and continuity artifacts to releases, which turns the passport into a repeatable operating habit rather than a one-off PDF.
- Data compounding:
  Benchmark percentiles are additive and get stronger as more opt-in aggregate records exist.

## Why DIY does not fully replicate this

- A vendor can clone the schema, but not the buyer-recognized registry history.
- A self-signed document does not provide third-party countersignature or revocation.
- Aggregate percentiles improve only when a trusted network sees enough opted-in records.
- Procurement workflows harden around stable verification URLs and release-linked artifacts.
- Buyer review gets easier when a human-readable verification page exists alongside the machine-readable verify endpoint.

## Seed-stage MVP wedge

This repository ships the narrowest version that still supports a durable wedge:

- Open spec package
- Deterministic signing and canonicalization
- Registry countersignature
- Tiered trust receipts (`baseline`, `reviewed`, `verified`)
- Revocation checks
- Release artifact workflow
- Basic vendor packet export
- Public registry telemetry that shows network growth without exposing customer repositories

## Future extraction path

The enrichment boundary is already isolated behind the `Enricher` interface in `packages/core`. That lets the scoring and enrichment logic move into a private package later without breaking the public schema, CLI contract, or registry contract.
