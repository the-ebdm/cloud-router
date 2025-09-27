import express from "express";
import { getHealthCheckInvocationById, getAllHealthCheckInvocations } from "@/lib/database";

const healthCheckInvocationsRouter = express.Router();

healthCheckInvocationsRouter.get('/', (req, res) => {
  const invocations = getAllHealthCheckInvocations();
  res.json(invocations);
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

export default healthCheckInvocationsRouter;
