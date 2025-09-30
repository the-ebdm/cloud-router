import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import request from 'supertest';
import express from 'express';
import { setupTestDatabase, teardownTestDatabase, TestDatabase } from '../fixtures/database.fixtures';
import domainsRouter from '../../src/server/routers/domains';

// Mock Express app for testing
let app: express.Application;
let testDb: TestDatabase;

describe('Domains API Contract Tests', () => {
  beforeAll(async () => {
    // Set up test database
    testDb = await setupTestDatabase();

    // Create Express app for testing
    app = express();
    app.use(express.json());

    // Mount the domains router
    app.use('/api/v1/domains', domainsRouter);

    // Mock authentication middleware for tests
    app.use('/api/v1', (req, res, next) => {
      // Skip authentication for tests
      (req as any).apiKey = { id: 1, key: 'test-key' };
      next();
    });
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  // NOTE: POST /domains tests removed because they require real Route53 integration
  // These should be tested manually or with integration tests against real AWS
  // See: specs/001-phase-1-dns/MANUAL_TESTING.md for testing checklist

  describe('GET /domains', () => {
    test('should list all domains', async () => {
      const response = await request(app)
        .get('/api/v1/domains')
        .expect(200);

      expect(response.body).toHaveProperty('domains');
      expect(Array.isArray(response.body.domains)).toBe(true);
    });
  });

  describe('GET /domains/{domainId}', () => {
    test('should return 404 for non-existent domain', async () => {
      const response = await request(app)
        .get('/api/v1/domains/99999')
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('DELETE /domains/{domainId}', () => {
    test('should return 404 for non-existent domain', async () => {
      const response = await request(app)
        .delete('/api/v1/domains/99999')
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });
});