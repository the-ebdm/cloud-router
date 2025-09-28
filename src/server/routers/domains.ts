import express from "express";
import { createDomain, getDomainById, getAllDomains, updateDomain, deleteDomain } from "@/lib/database";
import { getHostedZoneId } from "../utils";
import { $ } from "bun";
import { logger } from "@/lib/logger";

const domainsRouter = express.Router();

domainsRouter.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      logger.info('Validation error: Invalid domain name', { name });
      return res.status(400).json({ error: 'Domain name is required and must be a non-empty string' });
    }

    const trimmed = name.trim();
    logger.info('Attempting to create domain:', { name: trimmed });

    // Try to resolve a Route53 hosted zone ID for the domain. If we can't find one
    // we still create the domain record but leave hosted_zone_id null. This avoids
    // blocking the user if their CLI/permissions are not set up in the server environment.
    let hostedZoneId: string | null = null;
    try {
      hostedZoneId = await getHostedZoneId(trimmed);
      if (!hostedZoneId) {
        logger.info('No hosted zone found for domain or insufficient permissions', { domain: trimmed });
      } else {
        logger.info('Found hosted zone id for domain', { domain: trimmed, hostedZoneId });
      }
    } catch (err: any) {
      logger.error('Error while looking up hosted zone for domain', { domain: trimmed, error: err.message });
    }

    const id = createDomain({ name: trimmed, hosted_zone_id: hostedZoneId ?? undefined });
    logger.info(`Domain created successfully with ID: ${id}`);
    res.status(201).json({ id, hosted_zone_id: hostedZoneId });
  } catch (error: any) {
    logger.error('Domain creation failed:', { error: error.message, stack: error.stack });
    res.status(400).json({ error: 'Failed to create domain', details: error.message });
  }
});

domainsRouter.get('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid ID' });
  }
  const domain = getDomainById(id);
  if (!domain) {
    return res.status(404).json({ error: 'Domain not found' });
  }
  res.json(domain);
});

// New endpoint: list Route53 records for a domain by its DB id
domainsRouter.get('/:id/records', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
  const domain = getDomainById(id);
  if (!domain) return res.status(404).json({ error: 'Domain not found' });

  // If we have a hosted_zone_id stored use it, otherwise attempt lookup
  let hostedZoneId = domain.hosted_zone_id;
  if (!hostedZoneId) {
    hostedZoneId = await getHostedZoneId(domain.name).catch(() => null);
    if (!hostedZoneId) return res.status(404).json({ error: 'Hosted zone not found or permissions missing' });
  }

  try {
    const records = await $`aws route53 list-resource-record-sets --hosted-zone-id ${hostedZoneId} --output json`.json();
    // return the RecordSets array
    return res.json(records.ResourceRecordSets || []);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to list records', details: err.message });
  }
});

domainsRouter.get('/', (req, res) => {
  const domains = getAllDomains();
  res.json(domains);
});

domainsRouter.put('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid ID' });
  }
  const success = updateDomain(id, req.body);
  if (!success) {
    return res.status(404).json({ error: 'Domain not found or no changes' });
  }
  res.json({ message: 'Domain updated' });
});

domainsRouter.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid ID' });
  }
  const success = deleteDomain(id);
  if (!success) {
    return res.status(404).json({ error: 'Domain not found' });
  }
  res.json({ message: 'Domain deleted' });
});

// Import log from index.ts or define here
const log = (message: string, data?: any) => {
  const timestamp = new Date().toISOString();
  console.log(`[DOMAINS] [${timestamp}] ${message}`, data || '');
};

export default domainsRouter;
