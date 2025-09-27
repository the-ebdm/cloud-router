import express from "express";
import { createHealthCheckInvocation, getHealthCheckInvocationById, getAllHealthCheckInvocations, updateHealthCheckInvocation, deleteHealthCheckInvocation } from "../lib/database";

const healthCheckInvocationsRouter = express.Router();

healthCheckInvocationsRouter.post('/', (req, res) => {
  try {
    const id = createHealthCheckInvocation(req.body);
    res.status(201).json({ id });
  } catch (error) {
    res.status(400).json({ error: 'Failed to create health check invocation' });
  }
});

healthCheckInvocationsRouter.get('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid ID' });
  }
  const invocation = getHealthCheckInvocationById(id);
  if (!invocation) {
    return res.status(404).json({ error: 'Health check invocation not found' });
  }
  res.json(invocation);
});

healthCheckInvocationsRouter.get('/', (req, res) => {
  const invocations = getAllHealthCheckInvocations();
  res.json(invocations);
});

healthCheckInvocationsRouter.put('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid ID' });
  }
  const success = updateHealthCheckInvocation(id, req.body);
  if (!success) {
    return res.status(404).json({ error: 'Health check invocation not found or no changes' });
  }
  res.json({ message: 'Health check invocation updated' });
});

healthCheckInvocationsRouter.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid ID' });
  }
  const success = deleteHealthCheckInvocation(id);
  if (!success) {
    return res.status(404).json({ error: 'Health check invocation not found' });
  }
  res.json({ message: 'Health check invocation deleted' });
});

export default healthCheckInvocationsRouter;
