<!--
Sync Impact Report
- Version change: N/A → 1.0.0
- Modified principles: —
- Added sections: Core Principles; Security Requirements; Development Workflow & Quality Gates; Governance
- Removed sections: —
- Templates requiring updates:
  ✅ .specify/templates/plan-template.md (version + path reference)
  ✅ .specify/templates/tasks-template.md (categories mention observability/alerting)
  ⚠ README.md (expand docs when features mature)
- Follow-up TODOs: —
-->

# Cloud Router Constitution

## Core Principles

### I. Security-First Networking

Cloud Router MUST prioritize security for any externally reachable surface:

- All public endpoints MUST enforce TLS using ACME/Let’s Encrypt certificates and automatic renewal.
- Network access MUST assume zero trust; prefer Tailscale for node-to-node trust and narrow ACLs.
- Secrets MUST be stored outside of source control and NEVER logged; redact sensitive values in logs.
- Domain ownership and certificate challenges MUST be validated automatically with auditable records.

Rationale: The product exposes self‑hosted services to the internet. Strong defaults reduce risk and limit blast radius for inevitable failures.

### II. Declarative, Idempotent Configuration

System behavior MUST be defined declaratively via CLI/API configuration as the single source of truth:

- Configuration changes MUST be idempotent (safe to re‑apply) and support dry‑run and diff modes.
- Applying config MUST converge the running system to the described state or provide actionable errors.
- Config schemas MUST be versioned; backward‑compatible changes are preferred with clear migrations.

Rationale: Declarative control enables reproducibility, safe rollback, and reliable automation.

### III. Observability and Auditability

The system MUST make behavior visible and reconstructable:

- Use structured, leveled logging with correlation IDs on every request path.
- Persist request/response metadata for routing decisions; redact PII and secrets by default.
- Emit metrics for routing performance, certificate issuance/renewal, DNS ops, and health checks.
- Record health‑check results and surface alerts on sustained failures with clear runbooks.

Rationale: Troubleshooting routing issues requires high‑signal telemetry and durable audit trails.

### IV. Test‑First, Contract‑Driven Reliability

Reliability is enforced through tests before implementation:

- Follow Red‑Green‑Refactor: write contract and integration tests first, then implement to pass.
- Contracts MUST cover routing behavior, certificate lifecycles, DNS updates, and CLI/API schemas.
- Critical paths MUST have integration tests (tailscale connectivity, reverse proxying, persistence).

Rationale: Contract tests prevent regressions in user‑visible behavior and enable safe iteration.

### V. Simplicity and Semantic Versioning

Prefer the simplest solution that meets requirements and evolve with versioned changes:

- Avoid premature abstractions; remove unused code and features quickly.
- Apply Semantic Versioning to CLI, API, and config schemas. Deprecations MUST include timelines and
  migration guides. Breaking changes require a MAJOR release and explicit migration steps.

Rationale: Simplicity reduces operational load; clear versioning maintains user trust.

## Security Requirements

- Enforce HTTPS for all external endpoints; HSTS enabled where applicable.
- Automate ACME HTTP‑01/DNS‑01 challenges; renew before 30% lifetime remaining.
- Store credentials (e.g., Tailscale auth keys, IAM secrets) in a secure store; rotate on schedule.
- Apply least‑privilege IAM for DNS and certificate operations; no wildcard admin keys.
- Redact sensitive headers and bodies in persistent request logs; document redaction rules.
- Maintain audit logs for configuration changes with actor, timestamp, and diff.

## Development Workflow & Quality Gates

- Every feature MUST define testable acceptance criteria and pass Constitution checks.
- Tests MUST precede implementation for new endpoints, config schemas, and critical flows.
- CI MUST block merges on failing tests, lints, or Constitution compliance checks.
- Code reviews MUST verify security impacts, observability coverage, and migration notes for changes.
- Performance targets SHOULD be documented for routing latency and certificate/DNS operations.
- Documentation (README/docs) MUST be updated when user‑facing behavior or config changes.

## Governance

- This Constitution supersedes other process documents for Cloud Router.
- Amendments require a pull request describing rationale, impact, migration plan, and telemetry updates.
- Versioning policy: Semantic Versioning for the Constitution itself.
  - PATCH: Wording clarifications without changing intent.
  - MINOR: New principles/sections or materially expanded guidance.
  - MAJOR: Redefinitions/removals that change compliance meaning.
- Compliance reviews: All PRs MUST include a Constitution checklist referencing affected principles.
- Change log: Each amendment MUST update the version line below and summarize changes at the top.

**Version**: 1.0.0 | **Ratified**: 2025-09-29 | **Last Amended**: 2025-09-29
