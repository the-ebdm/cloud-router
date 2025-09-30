# Quickstart: ACME Certificate Management

**Feature**: ACME Certificate Management | **Date**: 2025-09-30

## Purpose

This quickstart guide provides step-by-step validation scenarios for ACME certificate management. These scenarios serve as both user acceptance tests and integration test specifications. Each scenario maps directly to the acceptance criteria in the feature specification.

## Prerequisites

### Environment Setup

1. **Let's Encrypt Staging Environment**: All testing must use Let's Encrypt staging to avoid rate limits
   ```bash
   export ACME_ENVIRONMENT=staging
   export ACME_DIRECTORY_URL=https://acme-staging-v02.api.letsencrypt.org/directory
   ```

2. **AWS Route53 Access**: Valid AWS credentials with Route53 permissions
   ```bash
   export AWS_REGION=us-east-1
   export AWS_ACCESS_KEY_ID=your_key
   export AWS_SECRET_ACCESS_KEY=your_secret
   ```

3. **Certificate Encryption Key**: Master key for private key encryption
   ```bash
   export CERT_ENCRYPTION_KEY=$(openssl rand -base64 32)
   ```

4. **Test Domain**: A domain delegated to Route53 for testing
   ```
   Test domain: test-cloud-router.example.com
   Hosted Zone ID: Z1234567890ABC
   ```

### Initial Setup

1. Start Cloud Router server:
   ```bash
   bun run src/server/index.ts
   ```

2. Register ACME account (one-time):
   ```bash
   curl -X POST http://localhost:3000/acme/account \
     -H "Content-Type: application/json" \
     -d '{
       "email": "test@example.com",
       "environment": "staging",
       "agree_to_terms": true
     }'
   ```

   Expected response:
   ```json
   {
     "id": 1,
     "email": "test@example.com",
     "environment": "staging",
     "status": "registered",
     "account_url": "https://acme-staging-v02.api.letsencrypt.org/acme/acct/..."
   }
   ```

## Scenario 1: Automatic Certificate Provisioning on Domain Creation

**Acceptance Criteria**: When a domain is added, system automatically provisions apex+wildcard certificate

### Steps

1. **Create domain with automatic certificate provisioning**:
   ```bash
   curl -X POST http://localhost:3000/domains \
     -H "Content-Type: application/json" \
     -d '{
       "name": "test-cloud-router.example.com"
     }'
   ```

   Expected response (immediate):
   ```json
   {
     "id": 1,
     "name": "test-cloud-router.example.com",
     "hosted_zone_id": "Z1234567890ABC",
     "certificate_provisioning_status": "pending",
     "created_at": "2025-09-30T12:00:00Z"
   }
   ```

2. **Poll for certificate status** (certificate provisioning happens in background):
   ```bash
   curl http://localhost:3000/domains/1/certificate
   ```

   Initial response:
   ```json
   {
     "id": 1,
     "domain_id": 1,
     "certificate_type": "default",
     "covered_domains": ["test-cloud-router.example.com", "*.test-cloud-router.example.com"],
     "status": "pending",
     "created_at": "2025-09-30T12:00:01Z"
   }
   ```

3. **Wait for provisioning to complete** (2-5 minutes):
   ```bash
   # Poll every 10 seconds
   watch -n 10 curl http://localhost:3000/domains/1/certificate
   ```

   Final response:
   ```json
   {
     "id": 1,
     "domain_id": 1,
     "certificate_type": "default",
     "covered_domains": ["test-cloud-router.example.com", "*.test-cloud-router.example.com"],
     "status": "active",
     "expires_at": "2025-12-29T12:00:00Z",
     "issued_at": "2025-09-30T12:02:34Z",
     "key_type": "ecdsa-256",
     "renewal_failure_count": 0
   }
   ```

4. **Verify certificate details**:
   ```bash
   curl http://localhost:3000/certificates/1
   ```

   Expected: Full certificate chain in PEM format

5. **Verify DNS challenge cleanup**:
   ```bash
   dig _acme-challenge.test-cloud-router.example.com TXT
   ```

   Expected: No TXT records (challenge records cleaned up)

### Validation

- ✅ Domain created immediately without blocking
- ✅ Certificate provisioning happens asynchronously
- ✅ Certificate covers both apex and wildcard domains
- ✅ Certificate status transitions: pending → active
- ✅ DNS challenge TXT records cleaned up after validation
- ✅ Certificate valid for 90 days (Let's Encrypt default)

---

## Scenario 2: Subdomain Routes Use Existing Wildcard Certificate

**Acceptance Criteria**: Routes with subdomains automatically use domain's wildcard certificate

### Steps

1. **Create service for routing**:
   ```bash
   curl -X POST http://localhost:3000/services \
     -H "Content-Type: application/json" \
     -d '{
       "domain_id": 1,
       "name": "API Service",
       "description": "Test API",
       "port": 8080,
       "is_active": true
     }'
   ```

2. **Create route with subdomain**:
   ```bash
   curl -X POST http://localhost:3000/routes \
     -H "Content-Type: application/json" \
     -d '{
       "domain_id": 1,
       "service_id": 1,
       "path": "api",
       "is_dedicated_subdomain": true,
       "is_active": true
     }'
   ```

   Expected: api.test-cloud-router.example.com created

3. **Verify route uses default certificate**:
   ```bash
   curl http://localhost:3000/routes/1
   ```

   Expected response should indicate certificate association:
   ```json
   {
     "id": 1,
     "domain_id": 1,
     "service_id": 1,
     "subdomain": "api.test-cloud-router.example.com",
     "certificate_id": 1
   }
   ```

4. **Create multiple additional subdomains**:
   ```bash
   # Create app subdomain
   curl -X POST http://localhost:3000/routes \
     -H "Content-Type: application/json" \
     -d '{
       "domain_id": 1,
       "service_id": 1,
       "path": "app",
       "is_dedicated_subdomain": true,
       "is_active": true
     }'
   ```

5. **Verify no additional certificates created**:
   ```bash
   curl http://localhost:3000/certificates?domain_id=1
   ```

   Expected: Only 1 certificate (the default apex+wildcard)

### Validation

- ✅ Subdomains automatically use wildcard certificate
- ✅ No additional certificates provisioned for subdomains
- ✅ All routes under same domain share one certificate
- ✅ Certificate covers unlimited subdomains via wildcard

---

## Scenario 3: Automatic Certificate Renewal

**Acceptance Criteria**: Certificates automatically renew when within 30 days of expiration

### Steps

1. **Create certificate near expiration** (for testing, manually set expiration):
   ```sql
   -- In test environment, manually update expiration to trigger renewal
   UPDATE certificates 
   SET expires_at = datetime('now', '+25 days')
   WHERE id = 1;
   ```

2. **Manually trigger renewal check** (simulates daily cron job):
   ```bash
   curl -X POST http://localhost:3000/admin/check-renewals
   ```

   Expected: Renewal initiated for certificate 1

3. **Monitor renewal progress**:
   ```bash
   curl http://localhost:3000/certificates/1/history
   ```

   Expected response:
   ```json
   [
     {
       "id": 1,
       "certificate_id": 1,
       "attempt_number": 1,
       "status": "in_progress",
       "started_at": "2025-09-30T12:30:00Z"
     }
   ]
   ```

4. **Wait for renewal completion** (2-5 minutes):
   ```bash
   watch -n 10 curl http://localhost:3000/certificates/1/history
   ```

   Final response:
   ```json
   [
     {
       "id": 1,
       "certificate_id": 1,
       "attempt_number": 1,
       "status": "success",
       "started_at": "2025-09-30T12:30:00Z",
       "completed_at": "2025-09-30T12:33:15Z",
       "created_at": "2025-09-30T12:30:00Z"
     }
   ]
   ```

5. **Verify certificate updated**:
   ```bash
   curl http://localhost:3000/certificates/1
   ```

   Expected: New expiration date (~90 days from now), new issued_at timestamp

6. **Verify old certificate no longer used**:
   - Check certificate serial number changed
   - Verify renewal_failure_count reset to 0

### Validation

- ✅ Renewal triggered when expires_at < 30 days
- ✅ Renewal completes successfully
- ✅ Certificate updated atomically (no downtime)
- ✅ Renewal history tracked
- ✅ Old certificate replaced seamlessly

---

## Scenario 4: Manual Custom Certificate Provisioning

**Acceptance Criteria**: Users can provision custom certificates for specific domains

### Steps

1. **Provision custom certificate for specific subdomain**:
   ```bash
   curl -X POST http://localhost:3000/certificates \
     -H "Content-Type: application/json" \
     -d '{
       "domain_id": 1,
       "domains": ["special.test-cloud-router.example.com"],
       "key_type": "rsa-2048"
     }'
   ```

   Expected response:
   ```json
   {
     "id": 2,
     "domain_id": 1,
     "certificate_type": "custom",
     "covered_domains": ["special.test-cloud-router.example.com"],
     "status": "pending",
     "key_type": "rsa-2048"
   }
   ```

2. **Monitor custom certificate provisioning**:
   ```bash
   curl http://localhost:3000/certificates/2
   ```

   Wait for status: "active"

3. **Verify both certificates exist**:
   ```bash
   curl http://localhost:3000/certificates?domain_id=1
   ```

   Expected: 2 certificates
   - Certificate 1: default, covers apex + wildcard
   - Certificate 2: custom, covers special subdomain

4. **Verify default certificate unchanged**:
   ```bash
   curl http://localhost:3000/domains/1/certificate
   ```

   Expected: Still returns certificate 1 (default)

### Validation

- ✅ Custom certificates can be provisioned
- ✅ Custom certificates coexist with default certificate
- ✅ Different key types supported
- ✅ Default certificate remains domain's primary certificate

---

## Scenario 5: Certificate Revocation

**Acceptance Criteria**: Certificates can be manually revoked with reason codes

### Steps

1. **Revoke custom certificate**:
   ```bash
   curl -X DELETE http://localhost:3000/certificates/2 \
     -H "Content-Type: application/json" \
     -d '{
       "reason": "superseded"
     }'
   ```

   Expected response:
   ```json
   {
     "message": "Certificate revoked successfully"
   }
   ```

2. **Verify certificate status**:
   ```bash
   curl http://localhost:3000/certificates/2
   ```

   Expected: status = "revoked"

3. **Verify revoked certificate not renewable**:
   ```bash
   curl -X POST http://localhost:3000/certificates/2/renew
   ```

   Expected: 400 error "Cannot renew revoked certificate"

### Validation

- ✅ Certificates can be revoked
- ✅ Revocation reason recorded
- ✅ Revoked certificates cannot be renewed
- ✅ Status updated to "revoked"

---

## Scenario 6: Certificate Export

**Acceptance Criteria**: Certificates can be exported in PEM and PFX formats

### Steps

1. **Export certificate in PEM format**:
   ```bash
   curl http://localhost:3000/certificates/1/export?format=pem \
     -o certificate.pem
   ```

   Verify file contains:
   ```bash
   cat certificate.pem | grep "BEGIN CERTIFICATE"
   cat certificate.pem | grep "BEGIN PRIVATE KEY"
   ```

2. **Export certificate in PFX format**:
   ```bash
   curl "http://localhost:3000/certificates/1/export?format=pfx&password=test123" \
     -o certificate.pfx
   ```

   Verify file is valid PKCS#12:
   ```bash
   openssl pkcs12 -info -in certificate.pfx -passin pass:test123
   ```

### Validation

- ✅ PEM export includes certificate chain and private key
- ✅ PFX export creates valid PKCS#12 archive
- ✅ Exported certificates can be used externally
- ✅ Export operations logged for audit

---

## Scenario 7: DNS-01 Challenge Failure and Retry

**Acceptance Criteria**: System retries failed provisioning with exponential backoff

### Steps

1. **Simulate DNS validation failure** (in test environment, temporarily remove Route53 permissions):
   ```bash
   # Remove Route53 write permissions temporarily
   # Then attempt to provision certificate
   curl -X POST http://localhost:3000/certificates \
     -H "Content-Type: application/json" \
     -d '{
       "domain_id": 1,
       "domains": ["retry-test.test-cloud-router.example.com"]
     }'
   ```

2. **Monitor retry attempts**:
   ```bash
   curl http://localhost:3000/certificates/3/history
   ```

   Expected: Multiple renewal events with increasing retry delays

3. **Restore Route53 permissions and wait for retry**:
   - System should automatically retry and succeed

4. **Verify error details recorded**:
   ```bash
   curl http://localhost:3000/certificates/3/history
   ```

   Expected: Failure events contain error_code and error_message

### Validation

- ✅ Failures recorded with error details
- ✅ Exponential backoff implemented
- ✅ System automatically retries
- ✅ Success after retry completes provisioning

---

## Scenario 8: Rate Limit Handling

**Acceptance Criteria**: System handles Let's Encrypt rate limits gracefully

### Steps

1. **Attempt to provision many certificates rapidly** (staging has lenient limits but still enforced):
   ```bash
   for i in {1..10}; do
     curl -X POST http://localhost:3000/certificates \
       -H "Content-Type: application/json" \
       -d "{
         \"domain_id\": 1,
         \"domains\": [\"test$i.test-cloud-router.example.com\"]
       }"
   done
   ```

2. **Monitor for rate limit errors**:
   ```bash
   curl http://localhost:3000/certificates
   ```

   Expected: Some certificates may show status "provision_failed" with error_code "RATE_LIMIT_HIT"

3. **Verify retry scheduled for next day**:
   ```bash
   curl http://localhost:3000/certificates/[id]/history
   ```

   Expected: next_retry_at set to ~24 hours later

### Validation

- ✅ Rate limit errors handled gracefully
- ✅ User-friendly error messages displayed
- ✅ Retry automatically scheduled
- ✅ No system crashes or failures

---

## Integration Test Scenarios

The above scenarios should be automated as integration tests in `tests/integration/`:

1. `automatic-provisioning.test.ts`: Scenarios 1 & 2
2. `certificate-renewal.test.ts`: Scenario 3
3. `custom-certificates.test.ts`: Scenario 4
4. `certificate-operations.test.ts`: Scenarios 5 & 6
5. `error-handling.test.ts`: Scenarios 7 & 8

Each test should:
- Use Let's Encrypt staging environment
- Clean up created resources after test
- Mock DNS propagation delays where appropriate
- Assert on database state as well as API responses
- Test idempotency (running same operation twice should be safe)

## Performance Validation

After all scenarios pass:

1. **Certificate provisioning time**: < 5 minutes average
2. **Renewal check time**: < 30 seconds for 100 certificates
3. **Certificate lookup time**: < 100ms
4. **Export operation time**: < 1 second

## Security Validation

1. **Private keys never logged**: Check all log files, no "BEGIN PRIVATE KEY" strings
2. **Private keys encrypted at rest**: Verify database contains encrypted BLOBs, not plain text
3. **Challenge records cleaned up**: No orphaned _acme-challenge TXT records in Route53
4. **Audit logs complete**: All certificate operations logged with correlation IDs

---

## Troubleshooting

### Certificate provisioning stuck in "pending"

Check:
1. DNS propagation: `dig _acme-challenge.[domain] TXT`
2. Route53 permissions: Verify IAM has route53:ChangeResourceRecordSets
3. ACME account status: Verify account is "registered"
4. Server logs: Check for error messages

### Renewal failures

Check:
1. Certificate expiration: Verify expires_at is actually < 30 days
2. Renewal history: Look for error_code and error_message
3. ACME rate limits: Check if hitting Let's Encrypt limits
4. DNS changes: Verify domain still delegated to Route53

### "Cannot renew revoked certificate"

Expected behavior - provision new certificate instead of renewing revoked one

---

**Test Coverage**: All 7 acceptance scenarios + 9 edge cases from specification  
**Estimated Test Time**: 30-45 minutes for full suite (due to DNS propagation delays)  
**Automation Priority**: High - these tests validate critical security infrastructure
