import express from "express";
import { Database } from "bun:sqlite";
import { DomainModel } from "@/lib/models/domain";
import { DNSRecordModel } from "@/lib/models/dns-record";
import { Route53ClientService } from "@/lib/services/route53-client";
import { HostedZoneCreationService } from "@/lib/services/hosted-zone-creation";
import { DNSRecordRetrievalService } from "@/lib/services/dns-record-retrieval";
import { logger } from "@/lib/logger";

// Initialize database and models
const db = new Database("database.sqlite");
const domainModel = new DomainModel(db);
const dnsRecordModel = new DNSRecordModel(db);

// Initialize services
const route53Client = new Route53ClientService();
const hostedZoneCreationService = new HostedZoneCreationService(route53Client, domainModel);
const dnsRecordRetrievalService = new DNSRecordRetrievalService(route53Client, dnsRecordModel, domainModel);

const domainsRouter = express.Router();

// POST /domains - Add a domain to Cloud Router
domainsRouter.post('/', async (req, res) => {
  try {
    const { name } = req.body;

    // Validate request
    if (!name || typeof name !== 'string' || !name.trim()) {
      logger.info('Validation error: Invalid domain name', { name });
      return res.status(400).json({ error: 'Domain name is required and must be a non-empty string' });
    }

    const trimmedName = name.trim();
    logger.info('Attempting to add domain:', { name: trimmedName });

    // Check if domain already exists
    const existingDomain = domainModel.findByName(trimmedName);
    if (existingDomain) {
      logger.info('Domain already exists', { name: trimmedName, id: existingDomain.id });
      return res.status(409).json({ error: 'Domain already exists' });
    }

    // Validate domain name format
    const validation = domainModel.validate({ name: trimmedName });
    if (!validation.valid) {
      logger.info('Domain validation failed', { name: trimmedName, errors: validation.errors });
      return res.status(400).json({ error: validation.errors.join(', ') });
    }

    // Create hosted zone and domain record
    const result = await hostedZoneCreationService.createHostedZone({
      domainName: trimmedName,
      createIfNotExists: true,
    });

    if (!result.success) {
      logger.error('Failed to create hosted zone', { name: trimmedName, error: result.error });
      return res.status(result.error?.includes('already exists') ? 409 : 500).json({
        error: result.error || 'Failed to create hosted zone'
      });
    }

    // Get the created domain with full details
    const domain = domainModel.findById(result.domainId!);
    if (!domain) {
      logger.error('Domain creation succeeded but domain not found', { domainId: result.domainId });
      return res.status(500).json({ error: 'Domain created but not found' });
    }

    // Return domain in API contract format
    const response = {
      id: domain.id,
      name: domain.name,
      hostedZoneId: domain.hosted_zone_id,
      delegationStatus: domain.delegation_status,
      createdAt: domain.created_at,
      updatedAt: domain.updated_at,
      zoneCreatedAt: domain.zone_created_at,
      lastSyncedAt: domain.last_synced_at,
      recordCount: domain.record_count,
    };

    logger.info('Domain added successfully', { id: domain.id, name: trimmedName });
    res.status(201).json(response);

  } catch (error: any) {
    logger.error('Domain creation failed:', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// GET /domains/{domainId} - Get domain details
domainsRouter.get('/:domainId', (req, res) => {
  try {
    const domainId = parseInt(req.params.domainId);
    if (isNaN(domainId)) {
      return res.status(400).json({ error: 'Invalid domain ID' });
    }

    // Get domain with DNS records
    const domainWithRecords = domainModel.findByIdWithDNSRecords(domainId);
    if (!domainWithRecords) {
      return res.status(404).json({ error: 'Domain not found' });
    }

    // Format DNS records according to API contract
    const dnsRecords = domainWithRecords.dnsRecords.map(record => ({
      id: record.id,
      name: record.name,
      type: record.type,
      value: record.value,
      ttl: record.ttl,
      priority: record.priority,
      weight: record.weight,
      source: record.source,
      createdByRouteId: record.created_by_route_id,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    }));

    // Format response according to API contract
    const response = {
      id: domainWithRecords.id,
      name: domainWithRecords.name,
      hostedZoneId: domainWithRecords.hosted_zone_id,
      delegationStatus: domainWithRecords.delegation_status,
      createdAt: domainWithRecords.created_at,
      updatedAt: domainWithRecords.updated_at,
      zoneCreatedAt: domainWithRecords.zone_created_at,
      lastSyncedAt: domainWithRecords.last_synced_at,
      recordCount: domainWithRecords.record_count,
      dnsRecords,
    };

    res.json(response);

  } catch (error: any) {
    logger.error('Failed to get domain details:', { error: error.message });
    res.status(500).json({ error: 'Failed to get domain details', details: error.message });
  }
});


// GET /domains - List domains
domainsRouter.get('/', (req, res) => {
  try {
    const domains = domainModel.findAll();

    // Format response according to API contract
    const response = {
      domains: domains.map(domain => ({
        id: domain.id,
        name: domain.name,
        hostedZoneId: domain.hosted_zone_id,
        delegationStatus: domain.delegation_status,
        createdAt: domain.created_at,
        updatedAt: domain.updated_at,
        zoneCreatedAt: domain.zone_created_at,
        lastSyncedAt: domain.last_synced_at,
        recordCount: domain.record_count,
      }))
    };

    res.json(response);
  } catch (error: any) {
    logger.error('Failed to list domains:', { error: error.message });
    res.status(500).json({ error: 'Failed to list domains', details: error.message });
  }
});

// POST /domains/{domainId}/sync - Sync DNS records
domainsRouter.post('/:domainId/sync', async (req, res) => {
  try {
    const domainId = parseInt(req.params.domainId);
    if (isNaN(domainId)) {
      return res.status(400).json({ error: 'Invalid domain ID' });
    }

    logger.info('Starting DNS sync for domain', { domainId });

    // Sync DNS records
    const syncResult = await dnsRecordRetrievalService.syncDNSRecords(domainId);

    if (!syncResult.success) {
      logger.error('DNS sync failed', { domainId, errors: syncResult.errors });
      return res.status(500).json({
        error: 'DNS synchronization failed',
        details: syncResult.errors.join(', ')
      });
    }

    // Format response according to API contract
    const response = {
      syncedRecords: syncResult.syncedCount,
      createdAt: new Date().toISOString(),
    };

    logger.info('DNS sync completed', {
      domainId,
      syncedRecords: syncResult.syncedCount,
      created: syncResult.createdCount,
      updated: syncResult.updatedCount,
      deleted: syncResult.deletedCount
    });

    res.json(response);

  } catch (error: any) {
    logger.error('DNS sync failed:', { error: error.message });
    res.status(500).json({ error: 'DNS synchronization failed', details: error.message });
  }
});

// DELETE /domains/{domainId} - Remove domain
domainsRouter.delete('/:domainId', (req, res) => {
  try {
    const domainId = parseInt(req.params.domainId);
    if (isNaN(domainId)) {
      return res.status(400).json({ error: 'Invalid domain ID' });
    }

    // Check if domain exists
    const domain = domainModel.findById(domainId);
    if (!domain) {
      return res.status(404).json({ error: 'Domain not found' });
    }

    // Check if domain has active routes (simplified check - in real implementation
    // would need to check routes table)
    // For now, we'll allow deletion but this should be enhanced
    // if (hasActiveRoutes(domainId)) {
    //   return res.status(409).json({ error: 'Cannot remove domain with active routes' });
    // }

    logger.info('Deleting domain', { domainId, name: domain.name });

    // Delete domain (this will cascade delete DNS records due to foreign key)
    const success = domainModel.delete(domainId);
    if (!success) {
      return res.status(404).json({ error: 'Domain not found or could not be deleted' });
    }

    logger.info('Domain deleted successfully', { domainId, name: domain.name });
    res.status(204).send(); // No content response

  } catch (error: any) {
    logger.error('Domain deletion failed:', { error: error.message });
    res.status(500).json({ error: 'Failed to delete domain', details: error.message });
  }
});

export default domainsRouter;
