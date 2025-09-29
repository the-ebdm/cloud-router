import { Database } from "bun:sqlite";
import { runMigrations } from "../../src/lib/database/migration";

// Test data fixtures for DNS testing
export interface TestDomain {
  id?: number;
  name: string;
  hosted_zone_id?: string;
  created_at: string;
  updated_at: string;
}

export interface TestService {
  id?: number;
  domain_id: number;
  name: string;
  description: string;
  port: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TestRoute {
  id?: number;
  domain_id: number;
  service_id: number;
  path: string;
  is_active: boolean;
  is_dedicated_subdomain: boolean;
  is_path: boolean;
  created_at: string;
  updated_at: string;
}

// Sample test data
export const testDomains: Omit<TestDomain, 'id' | 'created_at' | 'updated_at'>[] = [
  {
    name: 'example.com',
    hosted_zone_id: 'Z123456789ABCDEF',
  },
  {
    name: 'test.example.com',
    hosted_zone_id: 'Z987654321FEDCBA',
  },
  {
    name: 'api.example.com',
    hosted_zone_id: null, // No hosted zone yet
  },
  {
    name: 'subdomain.example.com',
    hosted_zone_id: 'Z123456789ABCDEF', // Same hosted zone as example.com
  },
];

export const testServices: Omit<TestService, 'id' | 'created_at' | 'updated_at'>[] = [
  {
    domain_id: 1, // example.com
    name: 'web-service',
    description: 'Main web service',
    port: 3000,
    is_active: true,
  },
  {
    domain_id: 2, // test.example.com
    name: 'test-service',
    description: 'Test environment service',
    port: 3001,
    is_active: true,
  },
  {
    domain_id: 3, // api.example.com
    name: 'api-service',
    description: 'API service',
    port: 4000,
    is_active: false, // Inactive for testing
  },
];

export const testRoutes: Omit<TestRoute, 'id' | 'created_at' | 'updated_at'>[] = [
  {
    domain_id: 1, // example.com
    service_id: 1, // web-service
    path: '/',
    is_active: true,
    is_dedicated_subdomain: false,
    is_path: true,
  },
  {
    domain_id: 2, // test.example.com
    service_id: 2, // test-service
    path: '/api',
    is_active: true,
    is_dedicated_subdomain: true,
    is_path: false,
  },
  {
    domain_id: 4, // subdomain.example.com
    service_id: 1, // web-service
    path: '/sub',
    is_active: true,
    is_dedicated_subdomain: true,
    is_path: true,
  },
];

// Test database setup and teardown utilities
export class TestDatabase {
  private db: Database;
  private originalDbPath?: string;

  constructor(dbPath?: string) {
    // Create in-memory database for testing by default
    this.db = new Database(dbPath || ':memory:');
  }

  async setup(): Promise<void> {
    // Run migrations to set up schema
    await runMigrations(this.db);

    // Insert test fixtures
    await this.insertTestData();
  }

  async teardown(): Promise<void> {
    // Clean up database
    this.db.close();
  }

  private async insertTestData(): Promise<void> {
    const now = new Date().toISOString();

    // Insert domains
    for (const domain of testDomains) {
      const stmt = this.db.prepare(`
        INSERT INTO domains (name, hosted_zone_id, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `);
      stmt.run(domain.name, domain.hosted_zone_id, now, now);
    }

    // Insert services
    for (const service of testServices) {
      const stmt = this.db.prepare(`
        INSERT INTO services (domain_id, name, description, port, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        service.domain_id,
        service.name,
        service.description,
        service.port,
        service.is_active,
        now,
        now
      );
    }

    // Insert routes
    for (const route of testRoutes) {
      const stmt = this.db.prepare(`
        INSERT INTO routes (domain_id, service_id, path, is_active, is_dedicated_subdomain, is_path, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        route.domain_id,
        route.service_id,
        route.path,
        route.is_active,
        route.is_dedicated_subdomain,
        route.is_path,
        now,
        now
      );
    }
  }

  getDatabase(): Database {
    return this.db;
  }

  // Utility method to get domain by name
  getDomainByName(name: string): TestDomain | undefined {
    const stmt = this.db.prepare('SELECT * FROM domains WHERE name = ?');
    return stmt.get(name) as TestDomain | undefined;
  }

  // Utility method to get all domains
  getAllDomains(): TestDomain[] {
    const stmt = this.db.prepare('SELECT * FROM domains');
    return stmt.all() as TestDomain[];
  }

  // Utility method to get service by name
  getServiceByName(name: string): TestService | undefined {
    const stmt = this.db.prepare('SELECT * FROM services WHERE name = ?');
    return stmt.get(name) as TestService | undefined;
  }
}

// Global test database instance for convenience
let globalTestDb: TestDatabase | null = null;

export const setupTestDatabase = async (): Promise<TestDatabase> => {
  if (!globalTestDb) {
    globalTestDb = new TestDatabase();
    await globalTestDb.setup();
  }
  return globalTestDb;
};

export const teardownTestDatabase = async (): Promise<void> => {
  if (globalTestDb) {
    await globalTestDb.teardown();
    globalTestDb = null;
  }
};

// Vitest setup/teardown hooks
export const beforeEachTest = async (): Promise<TestDatabase> => {
  return await setupTestDatabase();
};

export const afterEachTest = async (): Promise<void> => {
  await teardownTestDatabase();
};
