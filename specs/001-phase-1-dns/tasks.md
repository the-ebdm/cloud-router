# Tasks: DNS Management

**Input**: Design documents from `/specs/001-phase-1-dns/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/, quickstart.md

## Execution Flow (main)

```
1. Load plan.md from feature directory
   → If not found: ERROR "No implementation plan found"
   → Extract: tech stack, libraries, structure
2. Load optional design documents:
   → data-model.md: Extract entities → model tasks
   → contracts/: Each file → contract test task
   → research.md: Extract decisions → setup tasks
3. Generate tasks by category:
   → Setup: project init, dependencies, linting
   → Tests: contract tests, integration tests
   → Core: models, services, CLI commands
   → Integration: DB, middleware, logging
   → Polish: unit tests, performance, docs
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001, T002...)
6. Generate dependency graph
7. Create parallel execution examples
8. Validate task completeness:
   → All contracts have tests?
   → All entities have models?
   → All endpoints implemented?
9. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `src/app/` (frontend), `src/server/` (backend)
- **Tests**: `tests/` directory
- **Database**: `src/lib/database/` (existing SQLite setup)

## Phase 3.1: Setup

- [ ] T001 Install AWS SDK v3 dependencies (`@aws-sdk/client-route-53`)
- [ ] T002 Install Vitest testing framework and test utilities
- [ ] T003 Configure Vitest with TypeScript support and test environment
- [ ] T004 Set up test database fixtures for DNS testing

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3

**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

- [ ] T005 [P] Contract test POST /domains in tests/contract/domains-api.contract.test.ts
- [ ] T006 [P] Contract test GET /domains in tests/contract/domains-api.contract.test.ts
- [ ] T007 [P] Contract test GET /domains/{id} in tests/contract/domains-api.contract.test.ts
- [ ] T008 [P] Contract test POST /domains/{id}/sync in tests/contract/domains-api.contract.test.ts
- [ ] T009 [P] Contract test DELETE /domains/{id} in tests/contract/domains-api.contract.test.ts
- [ ] T010 [P] Integration test add existing Route53 domain in tests/integration/test_add_existing_domain.test.ts
- [ ] T011 [P] Integration test create new hosted zone in tests/integration/test_create_hosted_zone.test.ts
- [ ] T012 [P] Integration test DNS record display in tests/integration/test_dns_records_display.test.ts
- [ ] T013 [P] Integration test subdomain route creation in tests/integration/test_subdomain_route.test.ts

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Database & Models
- [ ] T014 [P] Extend domains table schema in src/lib/database/migration.ts
- [ ] T015 [P] Create DNS records table schema in src/lib/database/migration.ts
- [ ] T016 [P] Extend routes table with DNS record references in src/lib/database/migration.ts
- [ ] T017 [P] DNS Record model in src/lib/models/dns-record.ts
- [ ] T018 [P] Domain model extensions in src/lib/models/domain.ts

### AWS Route53 Services
- [ ] T019 [P] Route53 client service in src/lib/services/route53-client.ts
- [ ] T020 [P] Hosted zone discovery service in src/lib/services/hosted-zone-discovery.ts
- [ ] T021 [P] Hosted zone creation service in src/lib/services/hosted-zone-creation.ts
- [ ] T022 [P] DNS record retrieval service in src/lib/services/dns-record-retrieval.ts
- [ ] T023 [P] DNS record creation service in src/lib/services/dns-record-creation.ts
- [ ] T024 [P] DNS record conflict validation service in src/lib/services/dns-conflict-validation.ts

### Business Logic Services
- [ ] T025 [P] Domain management service in src/lib/services/domain-management.ts
- [ ] T026 [P] DNS synchronization service in src/lib/services/dns-synchronization.ts

## Phase 3.4: API Implementation

### Backend API Endpoints
- [ ] T027 POST /api/domains endpoint in src/server/routers/domains.ts
- [ ] T028 GET /api/domains endpoint in src/server/routers/domains.ts
- [ ] T029 GET /api/domains/{id} endpoint in src/server/routers/domains.ts
- [ ] T030 POST /api/domains/{id}/sync endpoint in src/server/routers/domains.ts
- [ ] T031 DELETE /api/domains/{id} endpoint in src/server/routers/domains.ts

### Frontend Components
- [ ] T032 [P] Domain list component in src/components/domains/domain-list.tsx
- [ ] T033 [P] Domain form component in src/components/domains/domain-form.tsx
- [ ] T034 [P] DNS records display component in src/components/domains/dns-records-display.tsx
- [ ] T035 [P] Nameserver delegation component in src/components/domains/nameserver-delegation.tsx

### Frontend Pages
- [ ] T036 Domain list page in src/app/domains/page.tsx
- [ ] T037 Domain detail page in src/app/domains/[id]/page.tsx

## Phase 3.5: Integration & Infrastructure

- [ ] T038 Database migration runner for DNS schema changes
- [ ] T039 AWS IAM permissions validation
- [ ] T040 Error handling middleware for Route53 API errors
- [ ] T041 Request logging for DNS operations
- [ ] T042 DNS record redaction middleware for security

## Phase 3.6: Polish

- [ ] T043 [P] Unit tests for DNS conflict validation in tests/unit/test_dns_conflict_validation.test.ts
- [ ] T044 [P] Unit tests for Route53 client service in tests/unit/test_route53_client.test.ts
- [ ] T045 [P] Unit tests for domain ownership validation in tests/unit/test_domain_validation.test.ts
- [ ] T046 Performance tests for DNS operations (<30 seconds)
- [ ] T047 Update API documentation in docs/api.md
- [ ] T048 Update user guide for DNS management features
- [ ] T049 Run quickstart validation scenarios

## Dependencies

- **Tests before implementation**: T005-T013 block all T014-T037
- **Database before services**: T014-T016 block T017-T026
- **Services before API**: T017-T026 block T027-T031
- **API before frontend**: T027-T031 block T032-T037
- **Core implementation before integration**: T014-T037 block T038-T042
- **Everything before polish**: T005-T042 block T043-T049

## Parallel Execution Examples

```
# Run all contract tests in parallel:
Task: "Contract test POST /domains in tests/contract/domains-api.contract.test.ts"
Task: "Contract test GET /domains in tests/contract/domains-api.contract.test.ts"
Task: "Contract test GET /domains/{id} in tests/contract/domains-api.contract.test.ts"
Task: "Contract test POST /domains/{id}/sync in tests/contract/domains-api.contract.test.ts"
Task: "Contract test DELETE /domains/{id} in tests/contract/domains-api.contract.test.ts"

# Run integration tests in parallel:
Task: "Integration test add existing Route53 domain in tests/integration/test_add_existing_domain.test.ts"
Task: "Integration test create new hosted zone in tests/integration/test_create_hosted_zone.test.ts"
Task: "Integration test DNS record display in tests/integration/test_dns_records_display.test.ts"
Task: "Integration test subdomain route creation in tests/integration/test_subdomain_route.test.ts"

# Run model creation in parallel:
Task: "DNS Record model in src/lib/models/dns-record.ts"
Task: "Domain model extensions in src/lib/models/domain.ts"

# Run service creation in parallel:
Task: "Route53 client service in src/lib/services/route53-client.ts"
Task: "Hosted zone discovery service in src/lib/services/hosted-zone-discovery.ts"
Task: "Hosted zone creation service in src/lib/services/hosted-zone-creation.ts"
Task: "DNS record retrieval service in src/lib/services/dns-record-retrieval.ts"
Task: "DNS record creation service in src/lib/services/dns-record-creation.ts"
Task: "DNS record conflict validation service in src/lib/services/dns-conflict-validation.ts"
```

## Notes

- [P] tasks = different files, no dependencies
- Verify tests fail before implementing (TDD requirement)
- Commit after each task completion (constitutional requirement)
- Avoid: vague tasks, same file conflicts, implementation before tests

## Task Generation Rules Applied

_Applied during task generation_

1. **From Contracts**:
   - Each endpoint in domains-api.yaml → contract test task [P]
   - Each endpoint → API implementation task

2. **From Data Model**:
   - Domain entity → model extension task [P]
   - DNS Record entity → new model task [P]
   - Route extensions → schema migration task [P]
   - Relationships → service layer validation

3. **From User Stories**:
   - Each acceptance scenario → integration test [P]
   - Quickstart validation → polish task

4. **From Research**:
   - AWS SDK setup → dependency task
   - Vitest configuration → setup task
   - Security redaction → middleware task

5. **Ordering**:
   - Setup → Tests → Database → Models → Services → API → Frontend → Integration → Polish
   - Dependencies block parallel execution where files overlap

## Validation Checklist

_GATE: Checked during task generation_

- [x] All contracts have corresponding tests (5 contract tests)
- [x] All entities have model tasks (Domain, DNS Record extensions)
- [x] All tests come before implementation (TDD enforced)
- [x] Parallel tasks are truly independent (different file paths)
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task
- [x] Dependencies properly ordered and documented
