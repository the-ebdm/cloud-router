# Research: ACME Certificate Management

**Feature**: ACME Certificate Management | **Date**: 2025-09-30 | **Phase**: 0

## Research Questions

### 1. ACME Client Library Selection

**Question**: Which ACME client library should we use for TypeScript/Bun applications?

**Decision**: Use `acme-client` (https://github.com/publishlab/node-acme-client)

**Rationale**:
- Pure JavaScript/TypeScript, compatible with Bun
- Full ACME v2 (RFC 8555) support
- Active maintenance and good documentation
- Built-in support for DNS-01 challenges with custom DNS providers
- Promise-based API that integrates well with async/await patterns
- TypeScript definitions available
- Production-ready and widely used

**Alternatives Considered**:
- **greenlock**: More opinionated, includes automatic renewal scheduling but adds complexity we don't need (we'll build our own scheduler)
- **node-acme**: Less actively maintained, fewer features
- **@root/acme**: Minimal but lacks TypeScript support and comprehensive docs
- **Raw ACME implementation**: Too much work, higher risk of protocol errors

**Implementation Notes**:
```typescript
import * as acme from 'acme-client';

// Create client with Let's Encrypt directory
const client = new acme.Client({
  directoryUrl: acme.directory.letsencrypt.production, // or .staging
  accountKey: await acme.crypto.createPrivateKey()
});
```

---

### 2. Private Key Encryption and Storage

**Question**: How should we encrypt and store private keys for certificates?

**Decision**: Use AES-256-GCM encryption with keys derived from environment variable + per-certificate salt, store encrypted keys in database as BLOB

**Rationale**:
- AES-256-GCM provides authenticated encryption (integrity + confidentiality)
- Per-certificate salt prevents pattern analysis if master key is compromised
- Database storage enables atomic updates and easier backup/restore
- Bun's native crypto module supports AES-256-GCM
- Master encryption key from environment (not in database or source control)
- Meets industry-standard encryption requirement from spec

**Alternatives Considered**:
- **File system storage**: More complex permission management, harder to backup atomically
- **Hardware Security Module (HSM)**: Overkill for MVP, significant cost and complexity
- **No encryption**: Violates constitutional security requirements
- **Database-level encryption**: Not sufficient (keys in memory), need application-level encryption

**Implementation Notes**:
```typescript
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

// Encryption
const salt = randomBytes(16);
const key = deriveKey(process.env.CERT_ENCRYPTION_KEY, salt);
const iv = randomBytes(12);
const cipher = createCipheriv('aes-256-gcm', key, iv);
const encrypted = Buffer.concat([cipher.update(privateKey), cipher.final()]);
const authTag = cipher.getAuthTag();

// Store: salt || iv || authTag || encrypted
```

---

### 3. Background Job Scheduling

**Question**: How should we implement background jobs for certificate renewal and async provisioning?

**Decision**: Use `node-cron` for renewal scheduler + in-memory queue with database-backed job persistence

**Rationale**:
- `node-cron` provides simple cron-like scheduling for daily renewal checks
- In-memory queue (async/await with semaphore) for async provisioning avoids external dependencies
- Database-backed job state enables crash recovery and monitoring
- Lightweight solution aligns with simplicity principle
- No need for Redis or other external queue systems for 100-certificate scale
- Easy to test and debug

**Alternatives Considered**:
- **Bull/BullMQ**: Requires Redis, adds operational complexity
- **Agenda**: MongoDB dependency, overkill for our use case
- **node-schedule**: Similar to node-cron but less flexible cron syntax
- **AWS EventBridge/Lambda**: Adds cloud dependencies, complicates local development

**Implementation Notes**:
```typescript
import cron from 'node-cron';

// Daily renewal check at 3 AM
cron.schedule('0 3 * * *', async () => {
  await checkCertificateRenewals();
});

// Async provisioning queue
class CertificateQueue {
  private processing = new Map<number, Promise<void>>();
  
  async enqueue(domainId: number) {
    if (this.processing.has(domainId)) return;
    const promise = this.provisionCertificate(domainId);
    this.processing.set(domainId, promise);
    try {
      await promise;
    } finally {
      this.processing.delete(domainId);
    }
  }
}
```

---

### 4. Let's Encrypt DNS-01 Challenge Validation

**Question**: What are the best practices for DNS-01 challenge timing and validation?

**Decision**: 
- Create TXT record via Route53
- Wait 90 seconds for propagation
- Poll for validation with exponential backoff (5s, 10s, 20s, max 5 attempts)
- Clean up TXT record immediately after validation (success or failure)
- Use Let's Encrypt staging environment for all development and testing

**Rationale**:
- Route53 typically propagates in 60-90 seconds globally
- 90-second initial wait reduces unnecessary API calls
- Exponential backoff prevents rate limit issues
- Staging environment prevents hitting production rate limits during development
- Immediate cleanup prevents stale records and security issues
- Aligns with constitutional security requirement (SR-005)

**Let's Encrypt Rate Limits**:
- Production: 50 certificates per registered domain per week
- Staging: More lenient, use for all testing
- Failed validations: 5 failures per account per hostname per hour
- Account registration: 10 accounts per IP address per 3 hours

**Implementation Notes**:
```typescript
// Create challenge record
await route53Client.upsertDNSRecords(hostedZoneId, [{
  name: `_acme-challenge.${domain}`,
  type: 'TXT',
  value: challengeValue,
  ttl: 60
}]);

// Wait for propagation
await sleep(90000);

// Validate with retry
for (const delay of [5000, 10000, 20000, 40000, 80000]) {
  try {
    await client.completeChallenge(challenge);
    break;
  } catch (error) {
    if (delay === 80000) throw error;
    await sleep(delay);
  }
}

// Cleanup
await route53Client.deleteDNSRecords(hostedZoneId, [challengeRecord]);
```

---

### 5. Certificate Renewal Strategy

**Question**: What is the optimal renewal strategy and failure handling approach?

**Decision**:
- Check all certificates daily for expiration within 30 days
- Renew immediately when threshold reached
- Retry failed renewals: 1 hour, 6 hours, 24 hours, then daily
- Notify after 3 consecutive failures
- Keep old certificate active until new one is validated
- Atomic swap of certificates (never leave domain without valid cert)

**Rationale**:
- Let's Encrypt certificates valid for 90 days, recommend renewal at 60 days (30 days before expiration)
- Daily checks ensure renewals happen promptly
- Retry schedule balances responsiveness with rate limit protection
- Keeping old cert active prevents service disruption
- Atomic swap ensures zero downtime
- Aligns with constitutional requirement (NFR-008)

**Failure Scenarios**:
1. DNS propagation timeout → Retry with longer wait
2. Rate limit hit → Queue renewal for next day
3. Route53 API failure → Retry with exponential backoff
4. ACME server down → Retry per schedule
5. Account key issues → Alert immediately (manual intervention required)

**Implementation Notes**:
```typescript
interface RenewalAttempt {
  certificateId: number;
  attemptCount: number;
  lastAttempt: Date;
  nextRetry: Date;
  error?: string;
}

const retryDelays = [
  60 * 60 * 1000,        // 1 hour
  6 * 60 * 60 * 1000,    // 6 hours
  24 * 60 * 60 * 1000,   // 24 hours
  // Then daily
];

async function renewCertificate(certId: number) {
  // Generate new certificate
  const newCert = await provisionCertificate(domain);
  
  // Validate new certificate
  await validateCertificate(newCert);
  
  // Atomic swap in database transaction
  await db.transaction(async (tx) => {
    await tx.updateCertificate(certId, {
      certificate_chain: newCert.chain,
      private_key: encryptKey(newCert.privateKey),
      expires_at: newCert.expiresAt,
      updated_at: new Date()
    });
  });
  
  // Old certificate automatically replaced, no downtime
}
```

---

### 6. Async Certificate Provisioning

**Question**: How should we handle automatic certificate provisioning without blocking domain creation?

**Decision**:
- Domain creation returns immediately with certificate status 'pending'
- Certificate provisioning happens in background queue
- Frontend polls certificate status or uses WebSocket for updates
- Provisioning failures recorded in certificate table with error details
- Users can retry failed provisioning manually

**Rationale**:
- Certificate provisioning can take 2-5 minutes (DNS propagation + validation)
- Blocking domain creation violates FR-018 and creates poor UX
- Background processing aligns with async pattern from existing Route53 operations
- Status polling is simple and works reliably (WebSocket optional enhancement)
- Manual retry gives users control when automatic provisioning fails

**Status Flow**:
```
Domain Created → Certificate Status: pending
                ↓
         Background Provisioning
                ↓
         ┌──────┴──────┐
         ↓             ↓
     Success        Failure
         ↓             ↓
    Status:       Status:
     active    provision_failed
                (with error details)
```

**Implementation Notes**:
```typescript
// Domain creation endpoint
app.post('/domains', async (req, res) => {
  const domain = await createDomain(req.body);
  
  // Trigger async cert provisioning
  if (req.body.provisionCertificate !== false) {
    certificateQueue.enqueue({
      domainId: domain.id,
      domains: [domain.name, `*.${domain.name}`]
    });
  }
  
  // Return immediately
  res.status(201).json({
    ...domain,
    certificate: { status: 'pending' }
  });
});

// Frontend polls for status
async function pollCertificateStatus(domainId) {
  const interval = setInterval(async () => {
    const cert = await fetch(`/domains/${domainId}/certificate`);
    if (cert.status !== 'pending') {
      clearInterval(interval);
      updateUI(cert);
    }
  }, 5000); // Poll every 5 seconds
}
```

---

## Summary of Decisions

1. **ACME Client**: `acme-client` library for full ACME v2 support
2. **Encryption**: AES-256-GCM with per-certificate salts, keys in database
3. **Scheduling**: `node-cron` for renewal checks, in-memory queue for async provisioning
4. **DNS-01 Timing**: 90s propagation wait, exponential backoff validation
5. **Renewal**: 30-day threshold, retry schedule with failure notifications
6. **Async Processing**: Background queue with status polling, non-blocking domain creation

All decisions align with constitutional requirements for security, simplicity, and observability.
