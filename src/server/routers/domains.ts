import express from "express";
import { createDomain, getDomainById, getAllDomains, updateDomain, deleteDomain } from "@/lib/database";
import { getHostedZoneId } from "../utils";
import { logger } from "@/lib/logger";

const domainsRouter = express.Router();

domainsRouter.post('/', (req, res) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      logger.info('Validation error: Invalid domain name', { name });
      return res.status(400).json({ error: 'Domain name is required and must be a non-empty string' });
    }

    logger.info('Attempting to create domain:', { name: name.trim() });
    const id = createDomain({ name: name.trim() });
    logger.info(`Domain created successfully with ID: ${id}`);
    res.status(201).json({ id });
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
