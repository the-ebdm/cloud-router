# ACME Certificate Management Data Model

**Feature**: ACME Certificate Management | **Date**: 2025-09-30

## Overview

The ACME certificate management feature extends the existing Cloud Router domain model to support automatic TLS certificate provisioning and renewal using Let's Encrypt. The design builds on the existing database schema while adding certificate-specific entities and relationships. Each domain gets one default apex+wildcard certificate automatically, with support for additional custom certificates.

## Existing Schema Integration

The feature extends the existing domains and certificates tables:

### Existing Domains Table
```sql
CREATE TABLE domains (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  hosted_zone_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### Existing Certificates Table (to be restructured)
```sql
-- Current structure (basic placeholder)
CREATE TABLE certificates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  domain_id INTEGER NOT NULL,
  path TEXT NOT NULL,
  is_active BOOLEAN NOT NULL,
  is_wildcard BOOLEAN NOT NULL,
  is_custom_domain BOOLEAN NOT NULL,
  is_dedicated_subdomain BOOLEAN NOT NULL,
  is_path BOOLEAN NOT NULL,
  is_redirect BOOLEAN NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (domain_id) REFERENCES domains(id)
);
```

**Migration Strategy**: The existing certificates table will be restructured to support ACME certificates. Existing data will be migrated if present, or table will be recreated if empty.

## Core Entities

### Certificate (Restructured)

**Purpose**: Represents a TLS certificate managed by Cloud Router, either automatically provisioned or manually requested.

**Attributes**:

- `id`: Primary key
- `domain_id`: Foreign key to domains table
- `certificate_type`: ENUM ('default', 'custom') - default = automatic apex+wildcard, custom = manually provisioned
- `covered_domains`: JSON array - list of domains/subdomains covered (e.g., ["example.com", "*.example.com"])
- `certificate_chain`: TEXT (PEM format) - full certificate chain including intermediates
- `private_key_encrypted`: BLOB - AES-256-GCM encrypted private key
- `private_key_salt`: BLOB - Salt for key derivation
- `private_key_iv`: BLOB - Initialization vector for encryption
- `private_key_auth_tag`: BLOB - GCM authentication tag
- `key_type`: ENUM ('rsa-2048', 'rsa-4096', 'ecdsa-256', 'ecdsa-384') - private key algorithm
- `status`: ENUM ('pending', 'active', 'expired', 'renewal_failed', 'revoked') - certificate lifecycle state
- `expires_at`: TIMESTAMP - certificate expiration date
- `issued_at`: TIMESTAMP - when certificate was issued
- `last_renewal_attempt`: TIMESTAMP - last renewal attempt timestamp
- `renewal_failure_count`: INTEGER - consecutive renewal failures (for alerting)
- `acme_order_url`: TEXT - ACME order URL for tracking
- `created_at`: TIMESTAMP
- `updated_at`: TIMESTAMP

**Relationships**:

- Many-to-one with Domain (each domain can have multiple certificates, but one default)
- One-to-many with Renewal Events
- One-to-many with Certificate Orders (during provisioning)

**Business Rules**:

- Each domain MUST have exactly one certificate with `certificate_type = 'default'`
- Default certificates MUST cover both apex and wildcard (["example.com", "*.example.com"])
- Private key MUST be encrypted before storage, never stored in plain text
- Status transitions: pending → active | renewal_failed | expired | revoked
- Certificates with `renewal_failure_count >= 3` trigger notifications
- Revoked certificates cannot be renewed, must provision new certificate

**Validation Rules**:

- covered_domains must be valid FQDNs or wildcard patterns
- certificate_chain must be valid PEM format
- expires_at must be in the future for active certificates
- private_key fields must all be present or all null (encrypted set)

### ACME Account

**Purpose**: Represents the Cloud Router's registered account with Let's Encrypt for ACME protocol operations.

**Attributes**:

- `id`: Primary key
- `email`: TEXT - contact email for ACME account
- `account_key`: TEXT (PEM format) - ACME account private key (distinct from certificate keys)
- `account_url`: TEXT - ACME account resource URL from Let's Encrypt
- `environment`: ENUM ('staging', 'production') - Let's Encrypt environment
- `status`: ENUM ('registered', 'deactivated', 'revoked') - account status
- `terms_of_service_agreed`: BOOLEAN - TOS acceptance flag
- `created_at`: TIMESTAMP
- `updated_at`: TIMESTAMP

**Relationships**:

- One ACME account per Cloud Router installation
- Associated with all certificate orders and provisioning operations

**Business Rules**:

- Only one active account per environment (staging/production)
- Account key must be securely stored (consider encryption in production)
- Email required for Let's Encrypt notifications
- Switching environments (staging ↔ production) requires new account registration

**Validation Rules**:

- Email must be valid email format
- account_key must be valid PEM private key
- account_url must be valid HTTPS URL

### Certificate Order

**Purpose**: Represents an in-progress ACME order for certificate issuance or renewal.

**Attributes**:

- `id`: Primary key
- `certificate_id`: Foreign key to certificates (null for initial provisioning)
- `domain_id`: Foreign key to domains
- `order_url`: TEXT - ACME order resource URL
- `authorization_urls`: JSON array - list of authorization URLs for challenges
- `finalize_url`: TEXT - URL to finalize the order
- `certificate_url`: TEXT - URL to download issued certificate (set after finalization)
- `status`: ENUM ('pending', 'ready', 'processing', 'valid', 'invalid') - ACME order status
- `domains`: JSON array - domains included in this order
- `challenge_type`: TEXT - challenge type used ('dns-01' for all our orders)
- `error`: TEXT - error message if order failed
- `created_at`: TIMESTAMP
- `updated_at`: TIMESTAMP

**Relationships**:

- Many-to-one with Certificate (renewal orders)
- Many-to-one with Domain (initial provisioning)
- One-to-many with DNS Challenge Records

**Business Rules**:

- Order lifecycle: pending → ready → processing → valid | invalid
- Orders expire after 7 days if not completed (Let's Encrypt policy)
- Failed orders (status=invalid) can be retried with new order
- Only one active order per certificate at a time

**State Transitions**:

```
pending (created)
  ↓ (challenges completed)
ready
  ↓ (CSR submitted)
processing
  ↓
┌─────┴─────┐
↓           ↓
valid    invalid
(success) (failure)
```

### Renewal Event

**Purpose**: Tracks certificate renewal attempts for monitoring and alerting.

**Attributes**:

- `id`: Primary key
- `certificate_id`: Foreign key to certificates
- `attempt_number`: INTEGER - nth attempt for this renewal cycle
- `status`: ENUM ('success', 'failure', 'in_progress') - renewal outcome
- `error_code`: TEXT - standardized error code (e.g., 'DNS_PROPAGATION_TIMEOUT', 'RATE_LIMIT_HIT')
- `error_message`: TEXT - detailed error message
- `started_at`: TIMESTAMP - when renewal attempt started
- `completed_at`: TIMESTAMP - when renewal attempt completed
- `next_retry_at`: TIMESTAMP - scheduled next retry (if failed)
- `created_at`: TIMESTAMP

**Relationships**:

- Many-to-one with Certificate

**Business Rules**:

- New renewal event created for each renewal attempt
- Success events mark certificate renewal cycle complete
- Failure events contain diagnostic information for troubleshooting
- Three consecutive failures trigger notification (queried from this table)

**Common Error Codes**:

- `DNS_PROPAGATION_TIMEOUT`: TXT record not propagated in time
- `RATE_LIMIT_HIT`: Let's Encrypt rate limit exceeded
- `DNS_VALIDATION_FAILED`: ACME server couldn't validate DNS-01 challenge
- `ROUTE53_API_ERROR`: AWS Route53 API failure
- `ACME_SERVER_ERROR`: Let's Encrypt server error
- `ACCOUNT_KEY_ERROR`: ACME account credentials issue

### DNS Challenge Record (Tracking)

**Purpose**: Tracks temporary TXT records created for DNS-01 validation, ensuring proper cleanup.

**Attributes**:

- `id`: Primary key
- `order_id`: Foreign key to certificate_orders
- `domain`: TEXT - domain for which challenge was created
- `record_name`: TEXT - full DNS record name (_acme-challenge.example.com)
- `record_value`: TEXT - challenge token value
- `hosted_zone_id`: TEXT - Route53 hosted zone ID
- `status`: ENUM ('created', 'validated', 'cleaned_up', 'cleanup_failed') - lifecycle status
- `created_at`: TIMESTAMP
- `validated_at`: TIMESTAMP
- `cleaned_up_at`: TIMESTAMP

**Relationships**:

- Many-to-one with Certificate Order

**Business Rules**:

- Challenge records MUST be deleted after validation (success or failure)
- Orphaned records (created > 1 hour ago, not cleaned up) flagged for manual cleanup
- One challenge record per domain per order
- Cleanup failures logged for manual intervention

**Lifecycle**:

```
created → validated → cleaned_up
         ↓ (validation failed)
      cleaned_up
```

### Domain-Certificate Association (Enhanced Domain Table)

**Purpose**: Links domains to their default certificate and tracks certificate provisioning settings.

**Schema Extension**:

```sql
ALTER TABLE domains ADD COLUMN default_certificate_id INTEGER;
ALTER TABLE domains ADD COLUMN auto_provision_certificate BOOLEAN DEFAULT TRUE;
ALTER TABLE domains ADD COLUMN certificate_provisioning_status ENUM('not_started', 'pending', 'completed', 'failed');
ALTER TABLE domains ADD FOREIGN KEY (default_certificate_id) REFERENCES certificates(id);
```

**New Attributes**:

- `default_certificate_id`: Foreign key to certificates - the default apex+wildcard cert
- `auto_provision_certificate`: Boolean - whether to auto-provision cert on domain creation
- `certificate_provisioning_status`: Status of automatic provisioning

**Business Rules**:

- Domain creation triggers automatic certificate provisioning (unless disabled)
- default_certificate_id set when default certificate reaches 'active' status
- Routes use default_certificate_id for TLS configuration

## Data Flow & Operations

### Automatic Certificate Provisioning on Domain Creation

1. User creates domain via API
2. Domain record created with `certificate_provisioning_status = 'pending'`
3. Background job queues certificate provisioning
4. Certificate record created with `status = 'pending'`, `certificate_type = 'default'`
5. ACME order created for apex + wildcard domains
6. DNS-01 challenge TXT records created in Route53
7. ACME validates challenges
8. Certificate issued and stored (encrypted)
9. Certificate status updated to 'active'
10. Domain default_certificate_id updated
11. Challenge records cleaned up

### Certificate Renewal Flow

1. Daily cron job checks all certificates with `expires_at < 30 days from now`
2. For each certificate needing renewal:
   - Create renewal event with `status = 'in_progress'`
   - Create new ACME order with same domains
   - Perform DNS-01 challenge validation
   - Issue new certificate
   - Atomic swap: update certificate record with new chain/key
   - Update renewal event with `status = 'success'`
   - Reset renewal_failure_count to 0
3. On failure:
   - Update renewal event with error details
   - Increment renewal_failure_count
   - Schedule retry using exponential backoff
   - If renewal_failure_count >= 3, trigger notification

### Manual Certificate Provisioning

1. User requests custom certificate via API
2. Certificate record created with `certificate_type = 'custom'`
3. Same ACME flow as automatic provisioning
4. Certificate not linked as domain default (optional association)

## Schema Migrations

### Migration 001: Restructure Certificates Table

```sql
-- Backup existing certificates (if any)
CREATE TABLE certificates_backup AS SELECT * FROM certificates;

-- Drop existing certificates table
DROP TABLE certificates;

-- Create new certificates table
CREATE TABLE certificates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  domain_id INTEGER NOT NULL,
  certificate_type TEXT NOT NULL DEFAULT 'default', -- 'default' or 'custom'
  covered_domains TEXT NOT NULL, -- JSON array
  certificate_chain TEXT, -- PEM format
  private_key_encrypted BLOB,
  private_key_salt BLOB,
  private_key_iv BLOB,
  private_key_auth_tag BLOB,
  key_type TEXT NOT NULL DEFAULT 'ecdsa-256',
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TEXT,
  issued_at TEXT,
  last_renewal_attempt TEXT,
  renewal_failure_count INTEGER NOT NULL DEFAULT 0,
  acme_order_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE CASCADE
);
```

### Migration 002: Create ACME Tables

```sql
-- ACME Account
CREATE TABLE acme_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  account_key TEXT NOT NULL,
  account_url TEXT NOT NULL,
  environment TEXT NOT NULL, -- 'staging' or 'production'
  status TEXT NOT NULL DEFAULT 'registered',
  terms_of_service_agreed BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Certificate Orders
CREATE TABLE certificate_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  certificate_id INTEGER,
  domain_id INTEGER NOT NULL,
  order_url TEXT NOT NULL,
  authorization_urls TEXT NOT NULL, -- JSON array
  finalize_url TEXT,
  certificate_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  domains TEXT NOT NULL, -- JSON array
  challenge_type TEXT NOT NULL DEFAULT 'dns-01',
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (certificate_id) REFERENCES certificates(id) ON DELETE SET NULL,
  FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE CASCADE
);

-- Renewal Events
CREATE TABLE renewal_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  certificate_id INTEGER NOT NULL,
  attempt_number INTEGER NOT NULL,
  status TEXT NOT NULL,
  error_code TEXT,
  error_message TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  next_retry_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (certificate_id) REFERENCES certificates(id) ON DELETE CASCADE
);

-- DNS Challenge Records
CREATE TABLE dns_challenge_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  domain TEXT NOT NULL,
  record_name TEXT NOT NULL,
  record_value TEXT NOT NULL,
  hosted_zone_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'created',
  created_at TEXT NOT NULL,
  validated_at TEXT,
  cleaned_up_at TEXT,
  FOREIGN KEY (order_id) REFERENCES certificate_orders(id) ON DELETE CASCADE
);
```

### Migration 003: Extend Domains Table

```sql
ALTER TABLE domains ADD COLUMN default_certificate_id INTEGER;
ALTER TABLE domains ADD COLUMN auto_provision_certificate BOOLEAN DEFAULT TRUE;
ALTER TABLE domains ADD COLUMN certificate_provisioning_status TEXT DEFAULT 'not_started';

CREATE INDEX idx_domains_certificate ON domains(default_certificate_id);
```

### Indexes for Performance

```sql
-- Certificates
CREATE INDEX idx_certificates_domain ON certificates(domain_id);
CREATE INDEX idx_certificates_status ON certificates(status);
CREATE INDEX idx_certificates_expires ON certificates(expires_at);
CREATE INDEX idx_certificates_type ON certificates(certificate_type);

-- Certificate Orders
CREATE INDEX idx_orders_certificate ON certificate_orders(certificate_id);
CREATE INDEX idx_orders_domain ON certificate_orders(domain_id);
CREATE INDEX idx_orders_status ON certificate_orders(status);

-- Renewal Events
CREATE INDEX idx_renewals_certificate ON renewal_events(certificate_id);
CREATE INDEX idx_renewals_status ON renewal_events(status);
CREATE INDEX idx_renewals_next_retry ON renewal_events(next_retry_at);

-- DNS Challenge Records
CREATE INDEX idx_challenges_order ON dns_challenge_records(order_id);
CREATE INDEX idx_challenges_status ON dns_challenge_records(status);
CREATE INDEX idx_challenges_created ON dns_challenge_records(created_at);
```

## Validation Rules

### Certificate Validation

- covered_domains must contain at least one valid domain
- Default certificates must contain exactly 2 domains: apex and wildcard
- certificate_chain must be valid PEM when status = 'active'
- private_key fields must all be present when status = 'active'
- expires_at must be in future for active certificates
- key_type must be one of supported algorithms

### ACME Account Validation

- Email must be valid email format
- account_key must be valid PEM private key
- account_url must be HTTPS URL
- Only one active account per environment

### Certificate Order Validation

- domains must contain valid FQDNs
- order_url, authorization_urls must be HTTPS URLs
- status must follow valid state transitions

### Renewal Event Validation

- attempt_number must be positive integer
- completed_at must be after started_at
- next_retry_at must be in future if status = 'failure'

## Performance Considerations

- Certificate lookups by domain_id indexed for fast retrieval
- Renewal checks filtered by expires_at index
- Challenge record cleanup uses created_at index
- JSON fields (covered_domains, authorization_urls) kept small for query performance
- Encrypted private keys stored as BLOB for efficient storage
- Indexes on foreign keys for join performance

## Security Considerations

- Private keys NEVER stored unencrypted
- Master encryption key from environment variable, not in database
- Per-certificate salt prevents rainbow table attacks
- GCM authentication tag prevents tampering
- Account keys stored securely (consider encryption in production)
- Audit logging for all certificate lifecycle events
- Challenge records cleaned up immediately to prevent abuse
