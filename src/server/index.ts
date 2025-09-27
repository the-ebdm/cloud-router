import express from "express";
import db from "@/lib/database";

import { runMigrations } from "@/lib/database/migration";

import {
  createDomain, getDomainById, getAllDomains, updateDomain, deleteDomain,
  createCertificate, getCertificateById, getAllCertificates, updateCertificate, deleteCertificate,
  createService, getServiceById, getAllServices, updateService, deleteService,
  createHealthCheck, getHealthCheckById, getAllHealthChecks, updateHealthCheck, deleteHealthCheck,
  createHealthCheckInvocation, getHealthCheckInvocationById, getAllHealthCheckInvocations, updateHealthCheckInvocation, deleteHealthCheckInvocation,
  createRoute, getRouteById, getAllRoutes, updateRoute, deleteRoute,
  createRequestLog, getRequestLogById, getAllRequestLogs, updateRequestLog, deleteRequestLog,
  createApiKey, getApiKeyById, getAllApiKeys, updateApiKey, deleteApiKey
} from "@/lib/database";

await runMigrations(db);

const app = express();

app.use(express.json());

// API Routes - /api/v1/{entity}
const apiRouter = express.Router();

apiRouter.use((req, res, next) => {
  // TODO: Add authentication
  next();
});

apiRouter.get('/status', (req, res) => {
  res.send("OK");
});

apiRouter.post('/domains', (req, res) => {
  try {
    const id = createDomain(req.body);
    res.status(201).json({ id });
  } catch (error) {
    res.status(400).json({ error: 'Failed to create domain' });
  }
});

apiRouter.get('/domains/:id', (req, res) => {
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

apiRouter.get('/domains', (req, res) => {
  const domains = getAllDomains();
  res.json(domains);
});

apiRouter.put('/domains/:id', (req, res) => {
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

apiRouter.delete('/domains/:id', (req, res) => {
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

apiRouter.post('/certificates', (req, res) => {
  try {
    const id = createCertificate(req.body);
    res.status(201).json({ id });
  } catch (error) {
    res.status(400).json({ error: 'Failed to create certificate' });
  }
});

apiRouter.get('/certificates/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid ID' });
  }
  const cert = getCertificateById(id);
  if (!cert) {
    return res.status(404).json({ error: 'Certificate not found' });
  }
  res.json(cert);
});

apiRouter.get('/certificates', (req, res) => {
  const certs = getAllCertificates();
  res.json(certs);
});

apiRouter.put('/certificates/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid ID' });
  }
  const success = updateCertificate(id, req.body);
  if (!success) {
    return res.status(404).json({ error: 'Certificate not found or no changes' });
  }
  res.json({ message: 'Certificate updated' });
});

apiRouter.delete('/certificates/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid ID' });
  }
  const success = deleteCertificate(id);
  if (!success) {
    return res.status(404).json({ error: 'Certificate not found' });
  }
  res.json({ message: 'Certificate deleted' });
});

apiRouter.post('/services', (req, res) => {
  try {
    const id = createService(req.body);
    res.status(201).json({ id });
  } catch (error) {
    res.status(400).json({ error: 'Failed to create service' });
  }
});

apiRouter.get('/services/:id', (req, res) => {
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

apiRouter.get('/services', (req, res) => {
  const services = getAllServices();
  res.json(services);
});

apiRouter.put('/services/:id', (req, res) => {
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

apiRouter.delete('/services/:id', (req, res) => {
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

apiRouter.post('/health_checks', (req, res) => {
  try {
    const id = createHealthCheck(req.body);
    res.status(201).json({ id });
  } catch (error) {
    res.status(400).json({ error: 'Failed to create health check' });
  }
});

apiRouter.get('/health_checks/:id', (req, res) => {
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

apiRouter.get('/health_checks', (req, res) => {
  const healthChecks = getAllHealthChecks();
  res.json(healthChecks);
});

apiRouter.put('/health_checks/:id', (req, res) => {
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

apiRouter.delete('/health_checks/:id', (req, res) => {
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

apiRouter.post('/health_check_invocations', (req, res) => {
  try {
    const id = createHealthCheckInvocation(req.body);
    res.status(201).json({ id });
  } catch (error) {
    res.status(400).json({ error: 'Failed to create health check invocation' });
  }
});

apiRouter.get('/health_check_invocations/:id', (req, res) => {
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

apiRouter.get('/health_check_invocations', (req, res) => {
  const invocations = getAllHealthCheckInvocations();
  res.json(invocations);
});

apiRouter.put('/health_check_invocations/:id', (req, res) => {
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

apiRouter.delete('/health_check_invocations/:id', (req, res) => {
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

apiRouter.post('/routes', (req, res) => {
  try {
    const id = createRoute(req.body);
    res.status(201).json({ id });
  } catch (error) {
    res.status(400).json({ error: 'Failed to create route' });
  }
});

apiRouter.get('/routes/:id', (req, res) => {
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

apiRouter.get('/routes', (req, res) => {
  const routes = getAllRoutes();
  res.json(routes);
});

apiRouter.put('/routes/:id', (req, res) => {
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

apiRouter.delete('/routes/:id', (req, res) => {
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

apiRouter.post('/requests', (req, res) => {
  try {
    const id = createRequestLog(req.body);
    res.status(201).json({ id });
  } catch (error) {
    res.status(400).json({ error: 'Failed to create request log' });
  }
});

apiRouter.get('/requests/:id', (req, res) => {
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

apiRouter.get('/requests', (req, res) => {
  const requests = getAllRequestLogs();
  res.json(requests);
});

apiRouter.put('/requests/:id', (req, res) => {
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

apiRouter.delete('/requests/:id', (req, res) => {
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

apiRouter.post('/api_keys', (req, res) => {
  try {
    const id = createApiKey(req.body);
    res.status(201).json({ id });
  } catch (error) {
    res.status(400).json({ error: 'Failed to create API key' });
  }
});

apiRouter.get('/api_keys/:id', (req, res) => {
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

apiRouter.get('/api_keys', (req, res) => {
  const apiKeys = getAllApiKeys();
  res.json(apiKeys);
});

apiRouter.put('/api_keys/:id', (req, res) => {
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

apiRouter.delete('/api_keys/:id', (req, res) => {
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

app.use('/api/v1', apiRouter);

app.listen(process.env.PORT || 3000, () => {
  console.log("Server is running on port " + (process.env.PORT || 3000));
});