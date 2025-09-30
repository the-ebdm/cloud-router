# DNS Management Data Model

**Feature**: DNS Management | **Date**: 2025-09-29

## Overview

The DNS management feature extends the existing Cloud Router domain model to support Route53 hosted zone management and DNS record operations. The design builds on the existing database schema while adding DNS-specific entities and relationships.

## Existing Schema Integration

The feature leverages the existing domains table structure:

```sql
CREATE TABLE domains (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  hosted_zone_id TEXT,  -- Route53 hosted zone ID
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

## Core Entities

### Domain (Extended)

**Purpose**: Represents a DNS domain managed by Cloud Router with Route53 integration.

**Attributes**:

- `id`: Primary key (existing)
- `name`: Domain name (existing)
- `hosted_zone_id`: Route53 hosted zone ID (existing)
- `delegation_status`: ENUM ('pending', 'completed', 'failed') - tracks domain registrar delegation
- `zone_created_at`: TIMESTAMP - when Route53 hosted zone was created
- `last_synced_at`: TIMESTAMP - last time DNS records were synchronized
- `record_count`: INTEGER - cached count of DNS records in zone

**Relationships**:

- One-to-many with Route (existing)
- One-to-many with Service (existing)
- One-to-many with DNS Record (new)

**Business Rules**:

- Domain name must be unique
- Hosted zone ID is required for DNS operations
- Delegation status affects UI display and functionality

### DNS Record

**Purpose**: Represents individual DNS records retrieved from or created in Route53.

**Attributes**:

- `id`: Primary key
- `domain_id`: Foreign key to domains table
- `name`: Record name (FQDN)
- `type`: Record type (A, CNAME, TXT, MX, etc.)
- `value`: Record value (IP, hostname, text, etc.)
- `ttl`: Time-to-live in seconds
- `priority`: MX record priority (optional)
- `weight`: Weighted routing weight (optional)
- `source`: ENUM ('route53', 'cloud_router') - indicates record origin
- `created_by_route_id`: Foreign key to routes (optional) - links to route that created this record
- `created_at`: TIMESTAMP
- `updated_at`: TIMESTAMP

**Relationships**:

- Many-to-one with Domain
- One-to-one with Route (optional)

**Business Rules**:

- Records created by Cloud Router (source = 'cloud_router') are managed automatically
- Route53-sourced records are read-only and synchronized periodically
- CNAME records cannot coexist with other records at same name

### Route (Extended)

**Purpose**: Routing configuration that may create subdomains via DNS records.

**Existing Schema**:

```sql
CREATE TABLE routes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  domain_id INTEGER NOT NULL,
  service_id INTEGER NOT NULL,
  path TEXT NOT NULL,
  is_active BOOLEAN NOT NULL,
  is_dedicated_subdomain BOOLEAN NOT NULL,
  is_path BOOLEAN NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

**Extensions**:

- `dns_record_id`: Foreign key to DNS records - links to created CNAME record
- `subdomain_name`: Computed field - full subdomain FQDN

**Business Rules**:

- When `is_dedicated_subdomain = true`, a CNAME record must be created
- DNS record creation is idempotent - same route won't create duplicate records
- Route deactivation should remove associated DNS records

## Data Flow & Synchronization

### Route53 Synchronization

1. **Zone Discovery**: On domain addition, query Route53 for matching hosted zones
2. **Record Import**: Retrieve all records from discovered/created hosted zone
3. **Periodic Sync**: Background process updates DNS records every 15 minutes
4. **Conflict Resolution**: Detect and handle manual Route53 changes

### DNS Record Creation

1. **Validation**: Check for existing records at target subdomain
2. **Creation**: Create CNAME record pointing to Cloud Router
3. **Tracking**: Link route to created DNS record
4. **Cleanup**: Remove DNS records when routes are deactivated

## Schema Migration

### Required Changes

1. **Domains Table Extensions**:

   ```sql
   ALTER TABLE domains ADD COLUMN delegation_status TEXT DEFAULT 'pending';
   ALTER TABLE domains ADD COLUMN zone_created_at TEXT;
   ALTER TABLE domains ADD COLUMN last_synced_at TEXT;
   ALTER TABLE domains ADD COLUMN record_count INTEGER DEFAULT 0;
   ```

2. **New DNS Records Table**:

   ```sql
   CREATE TABLE dns_records (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     domain_id INTEGER NOT NULL,
     name TEXT NOT NULL,
     type TEXT NOT NULL,
     value TEXT NOT NULL,
     ttl INTEGER NOT NULL,
     priority INTEGER,
     weight INTEGER,
     source TEXT NOT NULL DEFAULT 'route53',
     created_by_route_id INTEGER,
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL,
     FOREIGN KEY (domain_id) REFERENCES domains(id),
     FOREIGN KEY (created_by_route_id) REFERENCES routes(id)
   );
   ```

3. **Routes Table Extensions**:
   ```sql
   ALTER TABLE routes ADD COLUMN dns_record_id INTEGER;
   ALTER TABLE routes ADD CONSTRAINT fk_routes_dns_record
     FOREIGN KEY (dns_record_id) REFERENCES dns_records(id);
   ```

### Indexes

```sql
CREATE INDEX idx_dns_records_domain ON dns_records(domain_id);
CREATE INDEX idx_dns_records_name_type ON dns_records(name, type);
CREATE INDEX idx_dns_records_route ON dns_records(created_by_route_id);
CREATE INDEX idx_routes_dns_record ON routes(dns_record_id);
```

## Validation Rules

### Domain Validation

- Domain name format (RFC compliant)
- Hosted zone ownership verification
- Uniqueness constraints

### DNS Record Validation

- FQDN format for record names
- Valid record types and values
- TTL within acceptable ranges
- Conflict detection for same name/type combinations

### Route-DNS Integration

- Dedicated subdomain routes require valid DNS record creation
- Route deactivation triggers DNS record removal
- Idempotent operations prevent duplicate record creation

## Performance Considerations

- DNS record synchronization should be batched and rate-limited
- Cache frequently accessed zone information
- Implement pagination for large record sets
- Background processing for non-blocking operations
