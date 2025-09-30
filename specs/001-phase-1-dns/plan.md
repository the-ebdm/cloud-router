# Implementation Plan: DNS Management

**Branch**: `001-phase-1-dns` | **Date**: 2025-09-29 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-phase-1-dns/spec.md`

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

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:

- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary

Implement DNS management for Cloud Router to enable seamless domain integration with Route53. Users can add domains to automatically discover or create hosted zones, view all DNS records, and create subdomain routes that generate CNAME records. The solution uses AWS SDK v3 for Route53 integration, follows security-first principles with proper IAM permissions and audit logging, and implements contract-driven development with comprehensive testing.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js
**Primary Dependencies**: Next.js 15.5, Express 5.x, AWS SDK (for Route53), SQLite
**Storage**: SQLite database with existing domain/route/service schema
**Testing**: Node.js test framework (to be determined in research phase)
**Target Platform**: Linux server (AWS EC2 instance with IAM permissions)
**Project Type**: Web application (frontend + backend)
**Performance Goals**: <5 second domain discovery, <2 second record display, <10 second zone creation
**Constraints**: Must work within existing AWS IAM permissions, handle Route53 API rate limits
**Scale/Scope**: Handle domains with up to 1000 DNS records, support 100+ domains per installation

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

### Core Principles Compliance

**I. Security-First Networking**

- ✅ DNS operations require IAM permissions for Route53 - must use least-privilege access
- ✅ Domain ownership validation prevents unauthorized DNS modifications
- ✅ Audit logging required for DNS record changes
- ✅ DNS record display includes field-level redaction for sensitive TXT records

**II. Declarative, Idempotent Configuration**

- ✅ Domain addition and DNS record creation should be idempotent
- ✅ Configuration changes must converge to desired state

**III. Observability and Auditability**

- ✅ Structured logging with correlation IDs for DNS operations
- ✅ Metrics needed for Route53 API performance and error rates
- ✅ Audit logs for DNS record changes with actor tracking

**IV. Test-First, Contract-Driven Reliability**

- ✅ Contract tests created for all API endpoints (domains-api.contract.test.ts)
- ✅ Integration test scenarios defined in quickstart.md
- ✅ Red-Green-Refactor approach: contracts and tests precede implementation
- ✅ Error scenarios and edge cases covered in test specifications

**V. Simplicity and Semantic Versioning**

- ✅ Keep DNS operations simple and focused
- ✅ Version DNS-related APIs and schemas

### Security Requirements

- ✅ Least-privilege IAM for DNS operations
- ✅ Audit logs for configuration changes
- ✅ No sensitive data exposure in logs

### Development Workflow & Quality Gates

- ✅ Tests must precede DNS implementation
- ✅ Code review must verify security impacts
- ✅ Documentation updates for DNS functionality

## Project Structure

### Documentation (this feature)

```
specs/[###-feature]/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)

```
src/
├── app/                    # Next.js frontend
│   ├── domains/
│   │   ├── page.tsx        # Domain list page
│   │   └── [id]/
│   │       └── page.tsx    # Domain detail page (will show DNS records)
│   └── ...
├── server/                 # Express backend
│   ├── routers/
│   │   ├── domains.ts      # Existing domain router (extend for DNS)
│   │   └── ...
│   └── utils.ts
├── cli/                    # CLI tools
│   ├── index.ts
│   └── utils.ts
└── lib/
    ├── database/           # SQLite database layer
    │   ├── index.ts
    │   └── migration.ts    # Existing schema (extend for DNS data)
    └── logger.ts           # Winston logging

tests/                      # To be created
├── contract/               # API contract tests
├── integration/            # End-to-end DNS flow tests
└── unit/                   # Unit tests for DNS operations
```

**Structure Decision**: Web application structure with Next.js frontend and Express backend. DNS functionality will extend existing domain router and add new DNS-specific services. Database schema already supports domains with hosted_zone_id field.

## Phase 0: Outline & Research

1. **Extract unknowns from Technical Context** above:

   - For each NEEDS CLARIFICATION → research task
   - For each dependency → best practices task
   - For each integration → patterns task

2. **Generate and dispatch research agents**:

   ```
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each technology choice:
     Task: "Find best practices for {tech} in {domain}"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

## Phase 1: Design & Contracts

_Prerequisites: research.md complete_

1. **Extract entities from feature spec** → `data-model.md`:

   - Entity name, fields, relationships
   - Validation rules from requirements
   - State transitions if applicable

2. **Generate API contracts** from functional requirements:

   - For each user action → endpoint
   - Use standard REST/GraphQL patterns
   - Output OpenAPI/GraphQL schema to `/contracts/`

3. **Generate contract tests** from contracts:

   - One test file per endpoint
   - Assert request/response schemas
   - Tests must fail (no implementation yet)

4. **Extract test scenarios** from user stories:

   - Each story → integration test scenario
   - Quickstart test = story validation steps

5. **Update agent file incrementally** (O(1) operation):
   - Run `.specify/scripts/bash/update-agent-context.sh cursor`
     **IMPORTANT**: Execute it exactly as specified above. Do not add or remove any arguments.
   - If exists: Add only NEW tech from current plan
   - Preserve manual additions between markers
   - Update recent changes (keep last 3)
   - Keep under 150 lines for token efficiency
   - Output to repository root

**Output**: data-model.md, /contracts/\*, failing tests, quickstart.md, agent-specific file

## Phase 2: Task Planning Approach

_This section describes what the /tasks command will do - DO NOT execute during /plan_

**Task Generation Strategy**:

- Load `.specify/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs (contracts, data model, quickstart)
- **Contract Tests**: Each API endpoint in `contracts/domains-api.yaml` → dedicated contract test task [P]
- **Data Model**: Each entity extension in `data-model.md` → database migration and model task [P]
- **Integration Tests**: Each acceptance scenario in `quickstart.md` → integration test task
- **Implementation Tasks**: Core DNS operations (Route53 integration, domain discovery, record management)
- **UI Tasks**: Domain management pages and DNS record display components

**Task Categories** (following constitutional requirements):

1. **Security & Infrastructure** [Priority: High]

   - AWS SDK integration with proper IAM handling
   - Credential management and audit logging
   - Input validation and sanitization

2. **Data & Persistence** [Priority: High]

   - Database schema migrations
   - DNS record synchronization logic
   - Conflict detection and resolution

3. **Core DNS Operations** [Priority: High]

   - Route53 hosted zone discovery/creation
   - DNS record CRUD operations
   - Subdomain CNAME record management

4. **API & Integration** [Priority: Medium]

   - REST API endpoints for domain management
   - Error handling and user feedback
   - Background synchronization processes

5. **User Interface** [Priority: Medium]

   - Domain list and detail pages
   - DNS records display and management
   - Delegation status and instructions

6. **Testing & Validation** [Priority: High]
   - Contract tests for API compliance
   - Integration tests for end-to-end flows
   - Error scenario and edge case testing

**Ordering Strategy**:

- **TDD Order**: Contract tests → Implementation → Integration tests
- **Dependency Order**: Database schema → Core services → API endpoints → UI components
- **Security First**: Authentication/authorization before feature implementation
- **Parallel Execution**: Mark [P] for independent files (models, tests, UI components)
- **Constitutional Compliance**: Security and observability tasks prioritized

**Estimated Output**: 30-40 numbered, ordered tasks in tasks.md

**Risk Mitigation**:

- Early validation of AWS permissions and Route53 access
- Comprehensive error handling for DNS operations
- Gradual rollout: core DNS operations before UI enhancements
- Extensive testing coverage for critical DNS reliability requirements

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation

_These phases are beyond the scope of the /plan command_

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking

_Fill ONLY if Constitution Check has violations that must be justified_

| Violation                  | Why Needed         | Simpler Alternative Rejected Because |
| -------------------------- | ------------------ | ------------------------------------ |
| [e.g., 4th project]        | [current need]     | [why 3 projects insufficient]        |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient]  |

## Progress Tracking

_This checklist is updated during execution flow_

**Phase Status**:

- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:

- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [ ] Complexity deviations documented

---

_Based on Constitution v1.1.0 - See `.specify/memory/constitution.md`_
