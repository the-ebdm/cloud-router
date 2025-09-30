# DNS Management Quick Start Guide

**Feature**: DNS Management | **Date**: 2025-09-29

## Overview

This guide provides step-by-step instructions for testing the DNS management functionality in Cloud Router. It covers the primary user scenarios for adding domains, viewing DNS records, and creating subdomain routes.

## Prerequisites

1. **Cloud Router Installation**: Running on `http://localhost:3000`
2. **API Server**: Running on `http://localhost:3001`
3. **AWS Credentials**: EC2 instance with Route53 permissions
4. **Test Domain**: A domain you control for testing (e.g., `test.example.com`)

## Scenario 1: Add Existing Route53 Domain

**User Story**: As a service operator, I want to add my domain to Cloud Router so that I can easily create subdomains for my services and see all existing DNS records.

### Steps

1. **Navigate to Domains Page**

   ```
   Open http://localhost:3000/domains
   ```

2. **Add Domain**

   - Click "Add Domain" button
   - Enter domain name: `test.example.com`
   - Click "Add Domain"

3. **Verify Domain Discovery**

   - Should see success message: "Domain added successfully"
   - Domain should appear in the list with status "Active"
   - Hosted zone ID should be populated

4. **View DNS Records**
   - Click on the domain name in the list
   - Navigate to the domain detail page
   - Should see a "DNS Records" section
   - Verify existing records are displayed (type, name, value, TTL)

### Expected Results

- ✅ Domain appears in domains list
- ✅ Hosted zone ID is displayed
- ✅ DNS records tab shows existing Route53 records
- ✅ No errors in application logs

## Scenario 2: Create New Hosted Zone

**User Story**: As a service operator, I want Cloud Router to create a hosted zone when my domain doesn't exist in Route53.

### Steps

1. **Add Non-Existent Domain**

   ```
   POST http://localhost:3001/api/domains
   Content-Type: application/json

   {
     "name": "newtest.example.com"
   }
   ```

2. **Verify Hosted Zone Creation**

   - API should return 201 status
   - Response should include `hostedZoneId`
   - `delegationStatus` should be "pending"

3. **View Delegation Instructions**

   - Go to domain detail page: `http://localhost:3000/domains/{id}`
   - Should see "Domain Delegation" section
   - Nameserver records should be displayed prominently
   - Should include copy-to-clipboard functionality

4. **Complete Delegation Setup**

   - Copy nameserver records
   - Go to your domain registrar (e.g., Namecheap, GoDaddy)
   - Update NS records to point to Route53 nameservers
   - Wait 5-10 minutes for propagation

5. **Verify Delegation**
   ```
   nslookup -type=NS newtest.example.com
   ```
   - Should return the Route53 nameservers

### Expected Results

- ✅ Hosted zone created in Route53
- ✅ NS records displayed in UI
- ✅ Clear delegation instructions provided
- ✅ Domain status updates after delegation

## Scenario 3: Create Subdomain Route

**User Story**: As a service operator, I want to create routes with dedicated subdomains that automatically create DNS records.

### Prerequisites

- Domain added to Cloud Router (from Scenario 1 or 2)
- Service exists in Cloud Router

### Steps

1. **Create Route with Subdomain**

   ```
   POST http://localhost:3001/api/routes
   Content-Type: application/json

   {
     "domainId": 1,
     "serviceId": 1,
     "path": "api",
     "isDedicatedSubdomain": true,
     "isActive": true
   }
   ```

2. **Verify DNS Record Creation**

   - API should return 201 status
   - Route should be created successfully

3. **Check DNS Records**

   - Go to domain detail page
   - DNS records should show new CNAME record:
     - Name: `api.test.example.com`
     - Type: CNAME
     - Value: Points to Cloud Router domain
     - Source: "cloud_router"

4. **Test DNS Resolution**
   ```
   nslookup api.test.example.com
   ```
   - Should resolve to Cloud Router

### Expected Results

- ✅ CNAME record created in Route53
- ✅ Record appears in DNS records list
- ✅ DNS resolution works
- ✅ Route marked as having DNS record

## Scenario 4: DNS Record Synchronization

**User Story**: As a service operator, I want to see current DNS records from Route53.

### Steps

1. **Trigger Sync**

   ```
   POST http://localhost:3001/api/domains/{id}/sync
   ```

2. **Verify Sync Results**

   - API should return 200 status
   - Response should include `syncedRecords` count
   - `lastSyncedAt` timestamp should update

3. **Check Updated Records**
   - Refresh domain detail page
   - DNS records should be up-to-date
   - `lastSyncedAt` should show recent timestamp

### Expected Results

- ✅ DNS records synchronized from Route53
- ✅ Sync timestamp updated
- ✅ No duplicate records created

## Error Scenarios

### Domain Not Found in Route53

**Steps**:

1. Try to add domain that doesn't exist in Route53
2. Should automatically create hosted zone
3. Should show delegation instructions

**Expected**: Success with delegation guidance

### DNS Record Conflicts

**Steps**:

1. Try to create route where CNAME already exists
2. Should get validation error

**Expected**: Clear error message explaining conflict

### Route53 API Errors

**Steps**:

1. Simulate API outage or permission issues

**Expected**: Graceful error handling with user-friendly messages

## Validation Checklist

- [ ] All acceptance scenarios pass
- [ ] DNS records display correctly
- [ ] Subdomain creation works
- [ ] Hosted zone creation succeeds
- [ ] Delegation instructions are clear
- [ ] Error handling is robust
- [ ] No sensitive data exposed in logs
- [ ] Performance meets targets (<5s discovery, <2s display)

## Troubleshooting

### Common Issues

1. **"Domain not found" errors**

   - Check AWS credentials and Route53 permissions
   - Verify domain exists in your AWS account

2. **DNS delegation not working**

   - Wait longer for propagation (can take up to 48 hours)
   - Verify NS records at registrar match Route53

3. **Route creation fails**
   - Check if domain has proper hosted zone
   - Verify no existing DNS conflicts

### Debug Commands

```bash
# Check Route53 hosted zones
aws route53 list-hosted-zones --query 'HostedZones[?Name==`test.example.com.`]'

# Check DNS records
aws route53 list-resource-record-sets --hosted-zone-id Z123456789

# Test DNS resolution
dig api.test.example.com
```

## Next Steps

After completing this quickstart:

1. **Run Full Test Suite**: Execute all contract tests
2. **Performance Testing**: Verify response times meet targets
3. **Security Review**: Ensure no sensitive data exposure
4. **Documentation**: Update user guides with DNS management features
