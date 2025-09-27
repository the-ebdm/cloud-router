import express from "express";
import { createApiKey, getApiKeyById, getAllApiKeys, updateApiKey, deleteApiKey } from "../lib/database";

const apiKeysRouter = express.Router();

apiKeysRouter.post('/', (req, res) => {
  try {
    const id = createApiKey(req.body);
    res.status(201).json({ id });
  } catch (error) {
    res.status(400).json({ error: 'Failed to create API key' });
  }
});

apiKeysRouter.get('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid ID' });
  }
  const apiKey = getApiKeyById(id);
  if (!apiKey) {
    return res.status(404).json({ error: 'API key not found' });
  }
  res.json(apiKey);
});

apiKeysRouter.get('/', (req, res) => {
  const apiKeys = getAllApiKeys();
  res.json(apiKeys);
});

apiKeysRouter.put('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid ID' });
  }
  const success = updateApiKey(id, req.body);
  if (!success) {
    return res.status(404).json({ error: 'API key not found or no changes' });
  }
  res.json({ message: 'API key updated' });
});

apiKeysRouter.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid ID' });
  }
  const success = deleteApiKey(id);
  if (!success) {
    return res.status(404).json({ error: 'API key not found' });
  }
  res.json({ message: 'API key deleted' });
});

export default apiKeysRouter;
