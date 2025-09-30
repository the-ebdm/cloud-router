# Feature Specification: ACME Certificate Management

**Feature Branch**: `002-phase-2-acme`  
**Created**: 2025-09-30  
**Status**: Draft  
**Input**: User description: "Add ACME certificate provisioning and renewal for TLS certificates"

## User Scenarios & Testing _(mandatory)_

### Primary User Story

As a service operator, when I add a domain to Cloud Router, I want the system to automatically provision a single TLS certificate covering both the apex domain and wildcard subdomain (example.com + \*.example.com) using ACME (Let's Encrypt), so that I can freely create unlimited subdomains and routes without worrying about certificate management, and all my services are always secured with valid HTTPS certificates that renew automatically.

### Acceptance Scenarios

1. **Given** I add a new domain to Cloud Router with DNS properly delegated, **When** the domain creation completes, **Then** the system automatically provisions a single TLS certificate covering both the apex domain and wildcard subdomain (example.com + \*.example.com) using DNS-01 challenge, without requiring manual intervention

2. **Given** a domain with an automatically provisioned certificate, **When** I create routes with subdomains (api.example.com, app.example.com), **Then** all routes are immediately secured using the existing wildcard certificate without needing additional certificates

3. **Given** a certificate provisioned for a domain, **When** the certificate approaches expiration (within 30 days), **Then** the system automatically renews the certificate without user intervention

4. **Given** a domain with an active certificate, **When** I view the certificates page, **Then** I can see the certificate status, expiration date, covered domains (apex + wildcard), and renewal history

5. **Given** I have specific requirements, **When** I manually request a custom certificate (single domain only, specific subdomain, multiple domains), **Then** the system allows me to provision additional certificates beyond the default apex+wildcard certificate

6. **Given** multiple domains managed by Cloud Router, **When** certificates are due for renewal, **Then** the system processes renewals in priority order (soonest expiration first) and handles rate limits appropriately

7. **Given** a certificate provisioning attempt, **When** DNS validation fails or ACME server is unreachable, **Then** the system retries with exponential backoff and displays clear error messages with resolution steps

### Edge Cases

- What happens when automatic certificate provisioning fails during domain creation?
- How does the system handle ACME rate limits during bulk domain additions?
- What happens when DNS propagation delays cause DNS-01 challenge validation to timeout?
- What happens when a domain's hosted zone is deleted but certificates still exist?
- How are overlapping certificate requests handled (same domain combination requested multiple times)?
- What happens when a certificate renewal fails repeatedly?
- How does the system handle revoked or expired ACME account credentials?
- Can users opt out of automatic certificate provisioning when adding a domain?
- What happens when a user manually provisions a certificate that conflicts with the default apex+wildcard certificate?

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST automatically provision a combined apex+wildcard TLS certificate (example.com + \*.example.com) when a new domain is added to Cloud Router
- **FR-002**: System MUST use ACME protocol (Let's Encrypt) with DNS-01 challenge validation for all certificate operations
- **FR-003**: System MUST allow users to manually provision custom certificates (single domain, specific subdomains, or multiple domains) in addition to the default apex+wildcard certificate
- **FR-004**: System MUST automatically renew certificates when they are within 30 days of expiration
- **FR-005**: System MUST validate domain ownership by automatically creating and removing TXT records in Route53 for DNS-01 challenges
- **FR-006**: System MUST persist certificate data including public certificate chain, private key, expiration date, and covered domain list
- **FR-007**: System MUST display certificate status (active, pending, expired, revoked, renewal-failed) with visual indicators
- **FR-008**: System MUST provide certificate history showing all provisioning and renewal events with timestamps and outcomes
- **FR-009**: System MUST handle ACME account registration and key management securely
- **FR-010**: System MUST retry failed certificate operations with exponential backoff and maximum retry limits
- **FR-011**: System MUST prevent duplicate certificate requests for the same domain combination within a time window
- **FR-012**: System MUST allow manual certificate revocation with reason codes
- **FR-013**: System MUST support certificate export in standard formats (PEM, PFX) for external use
- **FR-014**: System MUST validate that requested domains exist in Route53 before attempting provisioning
- **FR-015**: System MUST clean up temporary DNS challenge records after successful or failed validation
- **FR-016**: System MUST display clear error messages for ACME failures with recommended resolution steps
- **FR-017**: System MUST associate the default apex+wildcard certificate with the domain so routes can automatically use it
- **FR-018**: System MUST process automatic certificate provisioning asynchronously so domain creation is not blocked by certificate issuance delays
- **FR-019**: System MUST allow users to optionally disable automatic certificate provisioning when creating a domain

### Non-Functional Requirements

- **NFR-001**: Certificate provisioning MUST complete within 5 minutes under normal conditions
- **NFR-002**: System MUST check for certificate renewals daily via automated background process
- **NFR-003**: System MUST support up to 100 active certificates across all managed domains
- **NFR-004**: Certificate private keys MUST be encrypted at rest using industry-standard encryption
- **NFR-005**: System MUST maintain audit logs for all certificate lifecycle events (provision, renew, revoke)
- **NFR-006**: System MUST handle Let's Encrypt rate limits (50 certificates per registered domain per week, 5 failed validations per hour)
- **NFR-007**: DNS-01 challenge TXT records MUST allow sufficient propagation time (minimum 60 seconds) before validation
- **NFR-008**: Certificate renewal failures MUST trigger notifications/alerts after 3 consecutive failures
- **NFR-009**: System MUST support ACME v2 protocol specification (RFC 8555)

### Security Requirements

- **SR-001**: Private keys MUST be generated securely with minimum 2048-bit RSA or 256-bit ECDSA
- **SR-002**: Private keys MUST never be logged or transmitted unencrypted
- **SR-003**: ACME account credentials MUST be stored securely and rotatable
- **SR-004**: Certificate operations MUST be audited with actor tracking and correlation IDs
- **SR-005**: DNS-01 challenge TXT records MUST be removed immediately after validation to prevent unauthorized use
- **SR-006**: Certificate export operations MUST be logged and potentially restricted to authorized users

### Key Entities _(include if feature involves data)_

- **Certificate**: Represents a TLS certificate managed by Cloud Router, containing covered domains (default: apex + wildcard), certificate chain, private key (encrypted), expiration date, status, certificate type (default vs custom), and issuance/renewal history. Each domain has one default certificate automatically provisioned
- **ACME Account**: Represents the Cloud Router's registered account with the ACME provider (Let's Encrypt), containing account key, contact email, and registration status
- **Certificate Order**: Represents an in-progress ACME order for certificate issuance or renewal, tracking challenge status, validation attempts, and completion state
- **Renewal Event**: Represents a certificate renewal attempt, including timestamp, outcome (success/failure), error details, and next retry schedule
- **DNS Challenge Record**: Temporary TXT record created in Route53 for DNS-01 validation, automatically cleaned up after validation completes
- **Domain-Certificate Association**: Links domains to their default certificate and tracks any additional custom certificates provisioned for specific use cases

---

## Review & Acceptance Checklist

_GATE: Automated checks run during main() execution_

### Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

---

## Execution Status

_Updated by main() during processing_

- [x] User description parsed
- [x] Key concepts extracted
- [x] Ambiguities marked
- [x] User scenarios defined
- [x] Requirements generated
- [x] Entities identified
- [x] Review checklist passed

---

## Dependencies & Assumptions

### Dependencies on Phase 1 (DNS Management)

- Domain management with Route53 hosted zone association
- DNS record creation and deletion capabilities
- Validated domain ownership through hosted zone control

### Assumptions

- Cloud Router has IAM permissions for Route53 DNS record management
- Domains are properly delegated to Route53 nameservers before certificate provisioning
- Let's Encrypt service is accessible from Cloud Router environment
- Sufficient storage available for certificate and private key storage
- System has ability to run background renewal processes

### Integration Points

- **Route53**: DNS-01 challenge TXT record creation/deletion using existing DNS management services
- **Let's Encrypt/ACME**: Certificate provisioning, renewal, and revocation
- **Domain Creation Flow**: Automatic certificate provisioning triggered when new domains are added
- **Domain Management**: One-to-one relationship between domains and default apex+wildcard certificates
- **Routing System**: Routes automatically use domain's default certificate (future integration)
- **Background Jobs**: Scheduled renewal checks and asynchronous certificate provisioning

---
