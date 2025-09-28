import express from "express";
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

await runMigrations(db);

const app = express();

app.use(express.json());

// API Routes - /api/v1/{entity}
const apiRouter = express.Router();

// Status endpoint
apiRouter.get('/status', async (req, res) => {
  const gitHash = await $`git rev-parse HEAD`.text();
  const shortHash = gitHash.slice(0, 7);
  res.send({
    status: "OK",
    deployedVersion: shortHash,
  });
});

// API-key authentication middleware
apiRouter.use((req, res, next) => {
  const authHeader = req.header('authorization') || req.header('Authorization');
  if (!authHeader) return res.status(401).json({ error: 'Missing Authorization header' });
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return res.status(400).json({ error: 'Invalid Authorization header format' });
  }
  const apiKey = parts[1];
  const keyRecord = getApiKeyByKey(apiKey);
  if (!keyRecord) return res.status(401).json({ error: 'Invalid API key' });
  if (keyRecord.revoked_at) return res.status(403).json({ error: 'API key revoked' });
  // Attach key info to request for handlers
  (req as any).apiKey = keyRecord;
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

app.listen(process.env.PORT || 3000, () => {
  console.log("Server is running on port " + (process.env.PORT || 3000));
});