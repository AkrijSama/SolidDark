# Threat Model

## What this MVP is meant to protect against

- weak buyer trust in self-asserted diligence claims
- unverifiable release-time diligence artifacts
- silent omission of scan gaps
- accidental over-sharing of repository contents during verification
- inability to revoke previously issued verification records

## What this MVP does well

- creates deterministic, signable artifacts
- separates local artifact generation from third-party verification
- records unknowns and errors explicitly
- supports online revocation checks
- packages procurement-facing outputs in a repeatable format

## What this MVP does not protect against

- malicious authors intentionally fabricating the local scan environment
- full software bill of materials completeness across all ecosystems
- legal compliance determination
- runtime compromise after a passport is issued
- deep secret scanning parity with dedicated enterprise scanners
- adversaries with access to local signing keys

## Assumptions

- buyers or auditors can independently query the registry
- registry keys are protected operationally outside this repository
- vendors understand that countersigning does not guarantee security

## Safety notes

- Verification is a trust signal, not a warranty.
- Reports remain informational only.
- Human review is still required for procurement, security, and legal decisions.
