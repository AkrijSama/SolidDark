# Rashomon

Rashomon is the security gate that protects you from your own AI agents.

It is a local-first desktop security proxy that monitors, analyzes, and controls outbound HTTP and HTTPS traffic from AI coding agents. Rashomon combines deterministic policy enforcement, credential exfiltration detection, agent-aware rate limiting, tamper-evident audit logs, and optional intent analysis to stop risky outbound actions before they leave the machine.

## Scope

- local desktop application built with Electron
- local HTTP/HTTPS proxy with optional TLS interception
- YAML-driven security policies
- SQLite audit trail with tamper-evident receipt chains
- React dashboard for real-time traffic, agents, policies, logs, and settings
- optional AI-based intent analysis via Anthropic or local Ollama

## Privacy model

- local-first by default
- fully functional offline except optional intent analysis
- secret values are always redacted in logs and UI
- binds to localhost only

## Current build contract

- no silent failures
- dark theme only
- every security decision yields an auditable receipt
- every outbound request is reduced into a machine-actionable manifest

## Development

```bash
pnpm install
pnpm run build
pnpm test
```
