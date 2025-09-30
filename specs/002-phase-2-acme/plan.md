# Implementation Plan: ACME Certificate Management

**Branch**: `002-phase-2-acme` | **Date**: 2025-09-30 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-phase-2-acme/spec.md`

## Execution Flow (/plan command scope)

```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from file system structure or context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Fill the Constitution Check section based on the content of the constitution document.
4. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
5. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (e.g., `CLAUDE.md` for Claude Code, `.github/copilot-instructions.md` for GitHub Copilot, `GEMINI.md` for Gemini CLI, `QWEN.md` for Qwen Code or `AGENTS.md` for opencode).
7. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 8. Phases 2-4 are executed by other commands:

- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary

Implement automatic ACME (Let's Encrypt) certificate management for Cloud Router. When domains are added, the system automatically provisions a combined apex+wildcard certificate (example.com + *.example.com) using DNS-01 challenge validation. Certificates renew automatically before expiration, and the system supports custom certificate provisioning for specific use cases. The solution integrates with existing Route53 DNS management, uses an ACME client library for protocol handling, encrypts private keys at rest, and provides comprehensive audit logging for all certificate lifecycle events.

## Technical Context

**Language/Version**: TypeScript 5.x / Bun  
**Primary Dependencies**: Next.js 15.5, Express 5.x, AWS SDK (Route53), SQLite, ACME client library (acme-client or similar)  
**Storage**: SQLite database (extend existing schema for certificates), file system for certificate/key storage with encryption  
**Testing**: Bun test framework, contract tests for certificate API, integration tests for ACME flow  
**Target Platform**: Linux server (AWS EC2) with Route53 IAM permissions  
**Project Type**: Web application (Next.js frontend + Express backend)  
**Performance Goals**: Certificate provisioning <5 minutes, renewal checks daily, support 100 active certificates  
**Constraints**: Let's Encrypt rate limits (50 certs/domain/week, 5 failed validations/hour), DNS propagation delays (60+ seconds), async processing required  
**Scale/Scope**: 100 domains, 100 certificates, automatic renewal for all certificates, 5-minute SLA for provisioning

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

### Core Principles Compliance

**I. Security-First Networking**

- ✅ All certificates use ACME/Let's Encrypt for automatic TLS provisioning
- ✅ Private keys encrypted at rest with industry-standard encryption (AES-256)
- ✅ Private keys never logged or transmitted unencrypted
- ✅ DNS-01 challenge TXT records cleaned up immediately after validation
- ✅ Certificate operations require validation of domain ownership via Route53 control
- ✅ Audit logging for all certificate lifecycle events (provision, renew, revoke, export)
- ✅ ACME account credentials stored securely and rotatable
- ✅ Least-privilege IAM for Route53 DNS operations

**II. Declarative, Idempotent Configuration**

- ✅ Certificate provisioning is idempotent - duplicate requests handled gracefully
- ✅ Automatic provisioning on domain creation is deterministic
- ✅ Renewal operations are idempotent and safe to retry
- ✅ System converges to desired state (all domains have valid certificates)

**III. Observability and Auditability**

- ✅ Structured logging with correlation IDs for all certificate operations
- ✅ Audit logs persist certificate lifecycle events with timestamps and actors
- ✅ Metrics for certificate provisioning success/failure, renewal status, expiration tracking
- ✅ Renewal failures trigger notifications after 3 consecutive failures
- ✅ Clear error messages with actionable resolution steps

**IV. Test-First, Contract-Driven Reliability**

- ✅ Contract tests for certificate API endpoints before implementation
- ✅ Integration tests for complete ACME provisioning and renewal flows
- ✅ Tests focus on user-visible behavior (certificate status, automatic renewal, error handling)
- ✅ Red-Green-Refactor: contracts and tests precede implementation
- ✅ Edge cases covered: rate limits, DNS propagation, renewal failures

**V. Simplicity and Semantic Versioning**

- ✅ Default behavior is simple: one apex+wildcard certificate per domain
- ✅ Manual custom certificates available but not required for most use cases
- ✅ Async processing keeps domain creation fast
- ✅ Certificate API versioned and documented

**VI. Atomic Commits & Agent Autonomy**

- ✅ Each artifact (research, data model, contracts, quickstart) committed atomically
- ✅ Implementation broken into atomic changes (ACME client, cert storage, renewal scheduler)
- ✅ Commits follow conventional format: `feat(acme): description`
- ✅ Agent has full autonomy to commit on feature branch

### Security Requirements

- ✅ HTTPS enforced with automatic ACME certificate provisioning
- ✅ Certificates renewed before 30% lifetime remaining (30 days for 90-day Let's Encrypt certs)
- ✅ ACME account credentials stored securely, not in source control
- ✅ Private keys encrypted at rest, never logged
- ✅ Least-privilege IAM for Route53 DNS operations
- ✅ Audit logs for all certificate operations with actor tracking

### Development Workflow & Quality Gates

- ✅ Acceptance criteria defined in spec (7 scenarios + edge cases)
- ✅ Contract tests will precede API implementation
- ✅ Integration tests will validate complete ACME flow
- ✅ Security impacts documented (key storage, encryption, audit logging)
- ✅ Performance targets documented (5-minute provisioning, daily renewal checks)
- ✅ Documentation will be updated (README with certificate management guide)

## Project Structure

### Documentation (this feature)

```
specs/002-phase-2-acme/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
│   ├── certificates-api.yaml
│   └── acme-flow.yaml
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)

```
src/
├── app/                          # Next.js frontend
│   ├── certificates/
│   │   └── page.tsx              # Enhanced to show apex+wildcard certs
│   ├── domains/
│   │   ├── page.tsx              # Enhanced to show cert status
│   │   └── [id]/
│   │       └── page.tsx          # Enhanced to show cert details
│   └── ...
├── server/                       # Express backend
│   ├── routers/
│   │   ├── certificates.ts       # Enhanced with ACME operations
│   │   └── domains.ts            # Enhanced to trigger auto cert provisioning
│   ├── jobs/                     # New: Background jobs
│   │   ├── certificate-renewal.ts
│   │   └── async-provisioning.ts
│   └── utils.ts
├── lib/
│   ├── database/
│   │   ├── index.ts              # Enhanced with certificate CRUD
│   │   └── migration.ts          # New migrations for cert tables
│   ├── services/                 # Existing DNS services + new ACME services
│   │   ├── acme-client.ts        # New: ACME protocol wrapper
│   │   ├── certificate-provisioning.ts  # New: Cert provisioning logic
│   │   ├── certificate-renewal.ts       # New: Renewal logic
│   │   ├── certificate-storage.ts       # New: Encrypted storage
│   │   └── dns-record-creation.ts       # Existing: Used for DNS-01 challenges
│   ├── models/
│   │   ├── certificate.ts        # New: Certificate model
│   │   └── acme-account.ts       # New: ACME account model
│   ├── config.ts                 # Enhanced with ACME config
│   └── logger.ts                 # Existing: Used for audit logs
└── types/
    └── acme.d.ts                 # New: ACME-related types

tests/
├── contract/
│   ├── certificates-api.contract.test.ts  # New: Cert API contract tests
│   └── acme-provisioning.contract.test.ts # New: ACME flow contract tests
└── integration/
    ├── automatic-provisioning.test.ts     # New: Auto cert on domain creation
    ├── certificate-renewal.test.ts        # New: Renewal flow
    └── dns-01-challenge.test.ts           # New: DNS-01 validation
```

**Structure Decision**: Web application structure with Next.js frontend and Express backend. Certificate management extends existing domain system. New ACME services integrate with existing Route53 DNS services for DNS-01 challenge validation. Background jobs added for async provisioning and daily renewal checks.

## Phase 0: Outline & Research

1. **Extract unknowns from Technical Context** above:

   - ACME client library selection (acme-client, node-acme, greenlock, or raw implementation)
   - Certificate storage strategy (file system vs database, encryption method)
   - Private key encryption (library, key management approach)
   - Background job scheduling (cron, node-schedule, or custom)
   - Let's Encrypt environment (staging vs production, account setup)
   - DNS-01 challenge validation timing (polling strategy, timeout handling)

2. **Generate and dispatch research agents**:

   ```
   Task: "Research ACME client libraries for TypeScript/Node.js"
   Task: "Find best practices for private key encryption and storage"
   Task: "Research background job scheduling for TypeScript/Bun applications"
   Task: "Understand Let's Encrypt DNS-01 challenge validation timing and best practices"
   Task: "Research certificate renewal strategies and failure handling"
   Task: "Find patterns for async certificate provisioning without blocking user requests"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

## Phase 1: Design & Contracts

_Prerequisites: research.md complete_

1. **Extract entities from feature spec** → `data-model.md`:

   - Certificate entity (domains, chain, private key, expiration, status, type)
   - ACME Account entity (account key, contact email, registration)
   - Certificate Order entity (in-progress orders, challenge status)
   - Renewal Event entity (renewal attempts, outcomes, retry schedule)
   - Domain-Certificate Association (default cert relationship)

2. **Generate API contracts** from functional requirements:

   - POST /certificates (manual provisioning)
   - GET /certificates (list all)
   - GET /certificates/:id (get details)
   - POST /certificates/:id/renew (manual renewal trigger)
   - POST /certificates/:id/revoke (revoke certificate)
   - GET /certificates/:id/export (export PEM/PFX)
   - POST /domains (enhanced to trigger auto cert provisioning)
   - GET /domains/:id/certificate (get domain's default certificate)
   - Output OpenAPI schemas to `/contracts/certificates-api.yaml`

3. **Generate contract tests** from contracts:

   - One test file per endpoint group
   - Assert request/response schemas match OpenAPI
   - Tests must fail (no implementation yet)

4. **Extract test scenarios** from user stories:

   - Automatic provisioning on domain creation
   - Subdomain routes use existing wildcard cert
   - Automatic renewal before expiration
   - Manual custom certificate provisioning
   - Rate limit handling
   - DNS validation failure and retry

5. **Update agent file incrementally** (O(1) operation):
   - Run `.specify/scripts/bash/update-agent-context.sh cursor`
   - Add new tech: ACME client library, certificate encryption
   - Preserve manual additions between markers
   - Update recent changes
   - Keep under 150 lines

**Output**: data-model.md, /contracts/\*, failing tests, quickstart.md, agent-specific file

## Phase 2: Task Planning Approach

_This section describes what the /tasks command will do - DO NOT execute during /plan_

**Task Generation Strategy**:

- Load `.specify/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs (contracts, data model, quickstart)
- **Contract Tests**: Each API endpoint in `contracts/certificates-api.yaml` → dedicated contract test task [P]
- **Data Model**: Each entity in `data-model.md` → database migration and model task [P]
- **Integration Tests**: Each acceptance scenario in `quickstart.md` → integration test task
- **Implementation Tasks**: ACME client integration, certificate provisioning, renewal scheduler, storage encryption
- **UI Tasks**: Certificate display pages, domain creation enhancement, cert status indicators

**Task Categories** (following constitutional requirements):

1. **Security & Infrastructure** [Priority: High]

   - ACME client integration with Let's Encrypt
   - Private key generation and encryption at rest
   - ACME account registration and credential management
   - Certificate storage with encryption
   - Audit logging for certificate operations

2. **Data & Persistence** [Priority: High]

   - Database schema migrations (certificates, ACME accounts, orders, renewals)
   - Certificate model with validation
   - ACME account model
   - Certificate-domain association
   - Migration from existing certificate table structure

3. **Core ACME Operations** [Priority: High]

   - ACME account registration and management
   - Certificate provisioning with DNS-01 challenge
   - DNS-01 challenge TXT record creation/cleanup
   - Certificate validation and storage
   - Certificate renewal logic
   - Certificate revocation

4. **Async & Background Processing** [Priority: High]

   - Async certificate provisioning on domain creation
   - Background renewal scheduler (daily checks)
   - Retry logic with exponential backoff
   - Rate limit handling and queuing
   - Renewal failure notifications

5. **API & Integration** [Priority: Medium]

   - Certificate API endpoints (list, get, provision, renew, revoke, export)
   - Domain creation enhancement (trigger auto provisioning)
   - Certificate-domain association endpoints
   - Error handling and user feedback
   - Export functionality (PEM, PFX formats)

6. **User Interface** [Priority: Medium]

   - Enhanced certificates page (apex+wildcard display)
   - Domain creation with cert provisioning option
   - Certificate status indicators
   - Renewal history display
   - Export interface

7. **Testing & Validation** [Priority: High]
   - Contract tests for certificate API
   - Integration tests for ACME provisioning flow
   - Integration tests for automatic renewal
   - DNS-01 challenge validation tests
   - Error scenario and edge case testing
   - Rate limit handling tests

**Ordering Strategy**:

- **TDD Order**: Contract tests → Implementation → Integration tests
- **Dependency Order**: Database schema → Models → ACME client → Services → API → UI → Background jobs
- **Security First**: Encryption and key storage before certificate provisioning
- **Parallel Execution**: Mark [P] for independent files (models, tests, UI components)
- **Constitutional Compliance**: Security and observability tasks prioritized
- **Async Integration**: Domain creation enhancement early to enable end-to-end testing

**Estimated Output**: 40-50 numbered, ordered tasks in tasks.md

**Risk Mitigation**:

- Early Let's Encrypt staging environment setup to avoid rate limits
- Comprehensive error handling for DNS propagation and ACME failures
- Gradual rollout: manual provisioning before automatic provisioning
- Extensive testing coverage for critical certificate reliability requirements
- Dry-run mode for testing renewal logic without actual certificate operations

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation

_These phases are beyond the scope of the /plan command_

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking

_Fill ONLY if Constitution Check has violations that must be justified_

No constitutional violations identified. The design follows all core principles:
- Security-first with encryption and audit logging
- Declarative and idempotent certificate operations
- Comprehensive observability and audit trails
- Test-first with contract-driven development
- Simple default behavior (one cert per domain)
- Atomic commits on feature branch

## Progress Tracking

_This checklist is updated during execution flow_

**Phase Status**:

- [x] Phase 0: Research complete (/plan command) → research.md created
- [x] Phase 1: Design complete (/plan command) → data-model.md, contracts/, quickstart.md created
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:

- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (none)

**Artifacts Generated**:

- [x] plan.md (this file)
- [x] research.md (ACME client selection, encryption, scheduling, DNS-01 timing)
- [x] data-model.md (Certificate, ACME Account, Certificate Order, Renewal Event schemas)
- [x] contracts/certificates-api.yaml (OpenAPI specification for certificate endpoints)
- [x] quickstart.md (8 integration test scenarios with validation steps)
- [x] .cursor/rules/specify-rules.mdc (updated with ACME technologies)

---

_Based on Constitution v1.1.0 - See `.specify/memory/constitution.md`_