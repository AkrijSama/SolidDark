# Privacy

## Default posture

SolidDark is privacy-by-default. The CLI does not upload repository contents during scan. Registry publication is explicit and minimal.

## Fields uploaded by `soliddark publish`

Only this payload is transmitted:

- `passport_hash`
- `tool_version`
- `generated_at`
- `ecosystems`
- `dependency_count`
- `vuln_count`
- `secret_findings_count`
- `unknowns_count`
- optional `project_label`

Explicitly not uploaded:

- source code
- file paths
- dependency names
- lockfiles
- code snippets
- secret values
- markdown report bodies
- continuity documents

## Benchmark ingestion

Benchmark ingestion is opt-in through `--bench-opt-in`. The MVP ingests anonymized aggregate metrics only:

- ecosystem
- metric name
- metric value
- source label
- generated timestamp

## Public registry telemetry

The registry can expose aggregate network telemetry for buyer confidence and operator visibility. That telemetry is limited to counts and aggregate metadata such as:

- issuance totals
- revocation totals
- benchmark record totals
- trust-tier counts
- ecosystems tracked
- latest issuance timestamp

It does not expose repository contents, dependency names, file paths, or passport bodies.

## Redaction rules

- API keys are redacted on display.
- Verification output references IDs and hashes, not repository contents.
- Secret scanning previews only show truncated detector matches.

## Unknown behavior

If the registry cannot be reached, the CLI records `UNKNOWN` and the reason. It never silently retries in a way that hides the failure, and it never claims the passport is verified when online verification is unavailable.
