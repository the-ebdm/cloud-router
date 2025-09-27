import express from "express";
import { createRequestLog, getRequestLogById, getAllRequestLogs, updateRequestLog, deleteRequestLog } from "@/lib/database";

const requestsRouter = express.Router();

requestsRouter.post('/', (req, res) => {
  try {
    const id = createRequestLog(req.body);
    res.status(201).json({ id });
  } catch (error) {
    res.status(400).json({ error: 'Failed to create request log' });
  }
});

requestsRouter.get('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid ID' });
  }
  const request = getRequestLogById(id);
  if (!request) {
    return res.status(404).json({ error: 'Request log not found' });
  }
  res.json(request);
});

requestsRouter.get('/', (req, res) => {
  const requests = getAllRequestLogs();
  res.json(requests);
});

requestsRouter.put('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid ID' });
  }
  const success = updateRequestLog(id, req.body);
  if (!success) {
    return res.status(404).json({ error: 'Request log not found or no changes' });
  }
  res.json({ message: 'Request log updated' });
});

requestsRouter.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid ID' });
  }
  const success = deleteRequestLog(id);
  if (!success) {
    return res.status(404).json({ error: 'Request log not found' });
  }
  res.json({ message: 'Request log deleted' });
});

export default requestsRouter;
