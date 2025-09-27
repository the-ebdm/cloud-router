import express from "express";
import { createRoute, getRouteById, getAllRoutes, updateRoute, deleteRoute } from "../lib/database";

const routesRouter = express.Router();

routesRouter.post('/', (req, res) => {
  try {
    const id = createRoute(req.body);
    res.status(201).json({ id });
  } catch (error) {
    res.status(400).json({ error: 'Failed to create route' });
  }
});

routesRouter.get('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid ID' });
  }
  const route = getRouteById(id);
  if (!route) {
    return res.status(404).json({ error: 'Route not found' });
  }
  res.json(route);
});

routesRouter.get('/', (req, res) => {
  const routes = getAllRoutes();
  res.json(routes);
});

routesRouter.put('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid ID' });
  }
  const success = updateRoute(id, req.body);
  if (!success) {
    return res.status(404).json({ error: 'Route not found or no changes' });
  }
  res.json({ message: 'Route updated' });
});

routesRouter.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid ID' });
  }
  const success = deleteRoute(id);
  if (!success) {
    return res.status(404).json({ error: 'Route not found' });
  }
  res.json({ message: 'Route deleted' });
});

export default routesRouter;
