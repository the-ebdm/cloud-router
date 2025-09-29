// Vitest setup file for global test configuration

// Add any global test setup here
// For example: mock setup, global beforeEach/afterEach hooks, etc.

// Example: Global test timeout
// vi.setConfig({ testTimeout: 10000 })

// Example: Mock environment variables for testing
process.env.NODE_ENV = 'test'

// Mock AWS SDK for testing
import { vi } from 'vitest'

// Mock Route53Client
vi.mock('@aws-sdk/client-route-53', () => ({
  Route53Client: vi.fn().mockImplementation(() => ({
    send: vi.fn()
  })),
  ListHostedZonesCommand: vi.fn(),
  GetHostedZoneCommand: vi.fn(),
  CreateHostedZoneCommand: vi.fn(),
  DeleteHostedZoneCommand: vi.fn(),
  ListResourceRecordSetsCommand: vi.fn(),
  ChangeResourceRecordSetsCommand: vi.fn(),
  ChangeAction: {
    CREATE: 'CREATE',
    DELETE: 'DELETE',
    UPSERT: 'UPSERT'
  }
}))
