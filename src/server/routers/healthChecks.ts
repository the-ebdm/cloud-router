import express from "express";
import { createHealthCheck, getHealthCheckById, getAllHealthChecks, updateHealthCheck, deleteHealthCheck } from "@/lib/database";

const healthChecksRouter = express.Router();

healthChecksRouter.post('/', (req, res) => {
  try {
    const id = createHealthCheck(req.body);
    res.status(201).json({ id });
  } catch (error) {
    res.status(400).json({ error: 'Failed to create health check' });
  }
});

healthChecksRouter.get('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid ID' });
  }
  const healthCheck = getHealthCheckById(id);
  if (!healthCheck) {
    return res.status(404).json({ error: 'Health check not found' });
  }
  res.json(healthCheck);
});

healthChecksRouter.get('/', (req, res) => {
  const healthChecks = getAllHealthChecks();
  res.json(healthChecks);
});

healthChecksRouter.put('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid ID' });
  }
  const success = updateHealthCheck(id, req.body);
  if (!success) {
    return res.status(404).json({ error: 'Health check not found or no changes' });
  }
  res.json({ message: 'Health check updated' });
});

healthChecksRouter.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid ID' });
  }
  const success = deleteHealthCheck(id);
  if (!success) {
    return res.status(404).json({ error: 'Health check not found' });
  }
  res.json({ message: 'Health check deleted' });
});

export default healthChecksRouter;
