import express from "express";
import cors from "cors";

import db, { getApiKeyByKey } from "@/lib/database";
import { runMigrations } from "@/lib/database/migration";

import domainsRouter from "./routers/domains";
import certificatesRouter from "./routers/certificates";
import servicesRouter from "./routers/services";
import healthChecksRouter from "./routers/healthChecks";
import healthCheckInvocationsRouter from "./routers/healthCheckInvocations";
import routesRouter from "./routers/routes";
import requestsRouter from "./routers/requests";
import apiKeysRouter from "./routers/apiKeys";

import { $ } from "bun";
import { logger } from "@/lib/logger";

const app = express();

app.use(express.json());
app.use(cors()); // Enables CORS for all routes

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - Body:`, req.body);
  next();
});

// API Routes - /api/v1/{entity}
const apiRouter = express.Router();

// Status endpoint
apiRouter.get('/status', async (req, res) => {
  const gitHash = await $`git rev-parse HEAD`.text();
  const shortHash = gitHash.slice(0, 7);
  res.json({
    status: "OK",
    deployedVersion: shortHash,
  });
  logger.info('Status request served');
});

// API-key authentication middleware
apiRouter.use((req, res, next) => {
  const authHeader = req.header('authorization') || req.header('Authorization');
  if (!authHeader) {
    logger.info('Missing Authorization header');
    return res.status(401).json({ error: 'Missing Authorization header' });
  }
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    logger.info('Invalid Authorization header format');
    return res.status(400).json({ error: 'Invalid Authorization header format' });
  }
  const apiKey = parts[1];
  const keyRecord = getApiKeyByKey(apiKey);
  if (!keyRecord) {
    logger.info('Invalid API key');
    return res.status(401).json({ error: 'Invalid API key' });
  }
  if (keyRecord.revoked_at) {
    logger.info('API key revoked');
    return res.status(403).json({ error: 'API key revoked' });
  }
  // Attach key info to request for handlers
  (req as any).apiKey = keyRecord;
  logger.info(`Authenticated request for key ID: ${keyRecord.id}`);
  next();
});

apiRouter.use('/domains', domainsRouter);
apiRouter.use('/certificates', certificatesRouter);
apiRouter.use('/services', servicesRouter);
apiRouter.use('/health_checks', healthChecksRouter);
apiRouter.use('/health_check_invocations', healthCheckInvocationsRouter);
apiRouter.use('/routes', routesRouter);
apiRouter.use('/requests', requestsRouter);
apiRouter.use('/api_keys', apiKeysRouter);

app.use('/api/v1', apiRouter);

// Global error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

const port = process.env.PORT || 3001; // Changed to 3001 to avoid conflict with Next.js
app.listen(port, () => {
  logger.info(`Server is running on port ${port}`);
});