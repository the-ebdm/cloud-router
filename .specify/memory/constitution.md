<!--
Sync Impact Report
- Version change: 1.0.1 → 1.1.0 (MINOR: new principle added)
- Modified principles: IV. Test‑First, Contract‑Driven Reliability (clarified test quality over quantity)
- Added sections: Test Categories subsection; VI. Atomic Commits & Agent Autonomy (new principle)
- Removed sections: —
- Templates requiring updates:
  ✅ .specify/templates/plan-template.md (version + path reference)
  ✅ .specify/templates/tasks-template.md (categories mention observability/alerting)
  ⚠ README.md (expand docs when features mature)
- Follow-up TODOs: Update plan.md constitution reference to v1.1.0
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

Reliability is enforced through meaningful tests before implementation:

**Test Quality Over Quantity**:

- Tests MUST validate user-visible behavior and business contracts, NOT implementation details
- Focus on acceptance criteria: what the system MUST do for users
- Avoid testing internal functions, private methods, or obvious code behavior
- Each test MUST provide regression protection or design feedback

**Test-First Development**:

- Follow Red‑Green‑Refactor: write contract and integration tests first, then implement to pass
- Contracts MUST cover routing behavior, certificate lifecycles, DNS updates, and CLI/API schemas
- Critical paths MUST have integration tests (tailscale connectivity, reverse proxying, persistence)

**Test Categories**:

- **Contract Tests**: API behavior and data contracts (highest value)
- **Integration Tests**: End-to-end user scenarios and system interactions
- **Unit Tests**: Complex business logic only when isolated testing adds value
- **Property Tests**: Edge cases and invariant validation where applicable

Rationale: Meaningful tests prevent regressions in user‑visible behavior, serve as living documentation, and enable safe refactoring without fear of breaking working functionality.

### V. Simplicity and Semantic Versioning

Prefer the simplest solution that meets requirements and evolve with versioned changes:

- Avoid premature abstractions; remove unused code and features quickly.
- Apply Semantic Versioning to CLI, API, and config schemas. Deprecations MUST include timelines and
  migration guides. Breaking changes require a MAJOR release and explicit migration steps.

Rationale: Simplicity reduces operational load; clear versioning maintains user trust.

### VI. Atomic Commits & Agent Autonomy

Feature development embraces atomic commits and agent-driven workflows:

**Commit Strategy**:

- Commits MUST be atomic: each commit contains one logical change that can be reviewed/tested independently
- Commit messages MUST follow conventional format: `type(scope): description` (e.g., `feat(dns): add hosted zone discovery`)
- Feature branches MUST use frequent, small commits rather than large batch commits
- No work-in-progress commits; each commit MUST leave the codebase in a working state

**Agent Autonomy on Feature Branches**:

- On feature branches (pattern: `###-feature-name`), agents have FULL autonomy to commit changes
- Agents MUST commit immediately after each atomic change (specs, plans, implementations, tests)
- Agents SHOULD commit after completing logical units: spec clarification, research phase, design artifacts, test implementation
- Agents MUST NOT wait for human approval to commit on feature branches
- Humans MAY squash/merge commits when merging to main, but atomic commits enable better review

**Quality Gates for Commits**:

- All commits MUST pass linting and basic validation (if CI configured)
- Breaking changes MUST be clearly marked in commit messages
- Commits affecting user-facing behavior MUST update relevant documentation

Rationale: Atomic commits enable better code review, easier debugging, and safer rollbacks. Agent autonomy on feature branches enables efficient development workflows while maintaining human oversight on main branch merges.

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

**Version**: 1.1.0 | **Ratified**: 2025-09-29 | **Last Amended**: 2025-09-29
