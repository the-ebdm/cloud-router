# DNS Management Research

**Feature**: DNS Management | **Date**: 2025-09-29

## Research Questions & Findings

### AWS Route53 Integration Patterns

**Question**: What are the best practices for Route53 integration in Node.js applications?

**Findings**:

- Decision: Use AWS SDK v3 for Route53 operations with modular imports
- Rationale: Better tree-shaking, smaller bundle size, improved TypeScript support
- Alternatives considered: AWS SDK v2 (legacy), third-party Route53 libraries (limited features)

**Implementation Notes**:

- Use `@aws-sdk/client-route-53` for hosted zone and record operations
- Implement proper error handling for Route53 API limits and throttling
- Use exponential backoff for retry logic on API failures

### Testing Framework Selection

**Question**: Which testing framework is appropriate for this Node.js/TypeScript project?

**Findings**:

- Decision: Use Vitest for unit and integration testing
- Rationale: Fast execution, built-in TypeScript support, Jest-compatible API, works well with Bun
- Alternatives considered: Jest (heavier, slower), Mocha+Chai (more configuration needed)

**Implementation Notes**:

- Vitest integrates well with existing Bun setup
- Use test doubles for AWS SDK calls to avoid real API calls during testing
- Contract tests will validate API schemas before implementation

### DNS Record Display Security

**Question**: How to safely display DNS records without exposing sensitive information?

**Findings**:

- Decision: Implement field-level filtering and redaction for sensitive record types
- Rationale: TXT records may contain secrets, some CNAME targets might be sensitive
- Alternatives considered: Complete record hiding (too restrictive), no filtering (security risk)

**Implementation Notes**:

- Redact TXT record values that appear to contain secrets
- Allow configurable redaction rules
- Log access to sensitive records for audit purposes

### Domain Discovery Performance

**Question**: How to efficiently discover Route53 hosted zones for domain names?

**Findings**:

- Decision: Use ListHostedZones API with domain name filtering
- Rationale: More efficient than listing all zones and filtering client-side
- Alternatives considered: Cache zone mappings (adds complexity), regex matching on zone names (less reliable)

**Implementation Notes**:

- Implement pagination handling for accounts with many hosted zones
- Cache zone discovery results with TTL to improve performance
- Handle multiple zones matching the same domain apex

### Hosted Zone Creation Workflow

**Question**: What is the complete workflow for creating Route53 hosted zones and guiding users through delegation?

**Findings**:

- Decision: Create hosted zone, extract NS records, present to user with clear delegation instructions
- Rationale: Follows AWS best practices for domain delegation setup
- Alternatives considered: Automated delegation (requires domain registrar API access)

**Implementation Notes**:

- Display NS records prominently after zone creation
- Provide copy-to-clipboard functionality for NS values
- Include clear instructions for domain registrar configuration
- Validate delegation completion through DNS queries

### DNS Record Conflict Prevention

**Question**: How to prevent DNS record conflicts when creating subdomains?

**Findings**:

- Decision: Implement pre-flight checks before creating CNAME records
- Rationale: Prevents DNS resolution issues and Route53 validation errors
- Alternatives considered: Allow conflicts and handle errors (poor UX), complex conflict resolution logic

**Implementation Notes**:

- Check for existing records at the target subdomain
- Validate record type compatibility (CNAME vs other records)
- Provide clear error messages when conflicts are detected

### Database Schema Extensions

**Question**: What additional database fields are needed for DNS functionality?

**Findings**:

- Decision: Extend existing domains table with DNS-specific metadata
- Rationale: Builds on existing schema, minimal migration impact
- Alternatives considered: Separate DNS tables (over-engineering), store in JSON fields (query limitations)

**Implementation Notes**:

- Add fields for zone creation timestamp and delegation status
- Consider audit table for DNS record changes
- Ensure foreign key relationships maintain data integrity

## Technical Decisions Summary

| Area                | Decision                     | Rationale                                 |
| ------------------- | ---------------------------- | ----------------------------------------- |
| AWS SDK             | v3 with modular imports      | Better performance and TypeScript support |
| Testing             | Vitest                       | Fast, TypeScript-native, Bun-compatible   |
| Security            | Field-level redaction        | Balance between visibility and security   |
| Performance         | API-side filtering + caching | Efficient zone discovery                  |
| UX                  | Manual delegation setup      | Simple, doesn't require registrar APIs    |
| Conflict Resolution | Pre-flight validation        | Prevent errors, better user experience    |
| Data Storage        | Extend existing schema       | Minimal changes, maintain relationships   |

## Open Research Items

None - all technical unknowns from Technical Context have been resolved.

## Risk Assessment

- **Low Risk**: Route53 API integration (well-documented AWS SDK)
- **Medium Risk**: DNS record security filtering (need careful implementation)
- **Low Risk**: Performance optimization (standard caching patterns)
- **Low Risk**: Database schema changes (simple extensions to existing tables)
