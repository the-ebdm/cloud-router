import express from "express";
import db from "@/lib/database";

import { runMigrations } from "@/lib/database/migration";

import domainsRouter from "./routers/domains";
import certificatesRouter from "./routers/certificates";
import servicesRouter from "./routers/services";
import healthChecksRouter from "./routers/healthChecks";
import healthCheckInvocationsRouter from "./routers/healthCheckInvocations";
import routesRouter from "./routers/routes";
import requestsRouter from "./routers/requests";
import apiKeysRouter from "./routers/apiKeys";

await runMigrations(db);

const app = express();

app.use(express.json());

// API Routes - /api/v1/{entity}
const apiRouter = express.Router();

// Authentication middleware
apiRouter.use((req, res, next) => {
  // TODO: Add authentication
  next();
});

// Status endpoint
apiRouter.get('/status', (req, res) => {
  res.send("OK");
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