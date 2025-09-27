import express from "express";
import { createService, getServiceById, getAllServices, updateService, deleteService } from "@/lib/database";

const servicesRouter = express.Router();

servicesRouter.post('/', (req, res) => {
  try {
    const id = createService(req.body);
    res.status(201).json({ id });
  } catch (error) {
    res.status(400).json({ error: 'Failed to create service' });
  }
});

servicesRouter.get('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid ID' });
  }
  const service = getServiceById(id);
  if (!service) {
    return res.status(404).json({ error: 'Service not found' });
  }
  res.json(service);
});

servicesRouter.get('/', (req, res) => {
  const services = getAllServices();
  res.json(services);
});

servicesRouter.put('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid ID' });
  }
  const success = updateService(id, req.body);
  if (!success) {
    return res.status(404).json({ error: 'Service not found or no changes' });
  }
  res.json({ message: 'Service updated' });
});

servicesRouter.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid ID' });
  }
  const success = deleteService(id);
  if (!success) {
    return res.status(404).json({ error: 'Service not found' });
  }
  res.json({ message: 'Service deleted' });
});

export default servicesRouter;
