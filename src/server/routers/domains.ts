import express from "express";
import { createDomain, getDomainById, getAllDomains, updateDomain, deleteDomain } from "../lib/database";

const domainsRouter = express.Router();

domainsRouter.post('/', (req, res) => {
  try {
    const id = createDomain(req.body);
    res.status(201).json({ id });
  } catch (error) {
    res.status(400).json({ error: 'Failed to create domain' });
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

export default domainsRouter;
