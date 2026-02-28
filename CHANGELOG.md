# Changelog

## v0.1.0 - 2026-02-28

Initial seed-stage MVP release of the SolidDark trust registry architecture.

### Added

- pnpm workspace monorepo with `spec`, `core`, `cli`, `registry`, and `sdk` packages
- open `risk-passport.json` schema package with exported JSON schema and example fixture
- deterministic canonical JSON serialization, SHA-256 hashing, and local Ed25519 signing
- `soliddark` CLI commands for init, key management, scan, continuity, publish, verify, and vendor packet export
- local trust registry service with countersigning, revocation, and benchmark percentile endpoints
- minimal registry SDK used by the CLI
- GitHub Actions example for release-attached diligence artifacts
- deterministic fixtures for Node, Python, and contradictory mixed lockfile cases
- integration coverage for scan output, secret detection, signing, publish/verify, revocation, percentiles, and vendor packet export
- documentation for defensibility, privacy, threat model, and licensing separation

### Changed

- moved the Next.js request gate from `middleware` to `proxy` for Next 16 compatibility
- hardened auth handling around missing sessions and client hydration
- updated Playwright smoke coverage to use stable selectors and production `next start`
- updated Prisma runtime integration for Prisma 7 adapter usage

### Verification

- `pnpm build:packages`
- `pnpm test`
- `pnpm exec tsc --noEmit`
- `pnpm build`
- `pnpm exec playwright test tests/e2e/auth.spec.ts tests/e2e/soul.spec.ts tests/e2e/vault.spec.ts`
- `node scripts/soliddark-proof.mjs`

### Notes

- Reports remain informational only and include non-legal-advice and no-security-guarantee disclaimers.
- Online verification depends on registry reachability; offline cases are recorded as `UNKNOWN`, never silently treated as verified.
