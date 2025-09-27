import { Database } from "bun:sqlite";

export const runMigrations = async (db: Database) => {
  await Bun.file("database.sqlite").exists().then((exists: boolean) => {
    if (!exists) {
      // Domains
      console.log("Running migrations for domains");
      db.query(`
        CREATE TABLE IF NOT EXISTS domains (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          hosted_zone_id TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `).run();

      // Certificates
      console.log("Running migrations for certificates");
      db.query(`
        CREATE TABLE IF NOT EXISTS certificates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          domain_id INTEGER NOT NULL,
          path TEXT NOT NULL,
          is_active BOOLEAN NOT NULL,
          is_wildcard BOOLEAN NOT NULL,
          is_custom_domain BOOLEAN NOT NULL,
          is_dedicated_subdomain BOOLEAN NOT NULL,
          is_path BOOLEAN NOT NULL,
          is_redirect BOOLEAN NOT NULL,
          expires_at TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `).run();

      // Services
      console.log("Running migrations for services");
      db.query(`
        CREATE TABLE IF NOT EXISTS services (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          domain_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          description TEXT NOT NULL,
          port INTEGER NOT NULL,
          is_active BOOLEAN NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `).run();

      // Health checks
      console.log("Running migrations for health checks");
      db.query(`
        CREATE TABLE IF NOT EXISTS health_checks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          service_id INTEGER NOT NULL,
          path TEXT NOT NULL,
          interval INTEGER NOT NULL,
          timeout INTEGER NOT NULL,
          threshold INTEGER NOT NULL,
          failure_threshold INTEGER NOT NULL,
          success_threshold INTEGER NOT NULL,
          status_code INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `).run();

      // Health check invocations
      console.log("Running migrations for health check invocations");
      db.query(`
        CREATE TABLE IF NOT EXISTS health_check_invocations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          health_check_id INTEGER NOT NULL,
          status TEXT NOT NULL,
          response_time INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `).run();

      // Routes
      console.log("Running migrations for routes");
      db.query(`
        CREATE TABLE IF NOT EXISTS routes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          domain_id INTEGER NOT NULL,
          service_id INTEGER NOT NULL,
          path TEXT NOT NULL,
          is_active BOOLEAN NOT NULL,
          is_dedicated_subdomain BOOLEAN NOT NULL,
          is_path BOOLEAN NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `).run();

      // Requests
      console.log("Running migrations for requests");
      db.query(`
        CREATE TABLE IF NOT EXISTS requests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          service_id INTEGER NOT NULL,
          url TEXT NOT NULL,
          method TEXT NOT NULL,
          status TEXT NOT NULL,
          response_time INTEGER NOT NULL,
          user_agent TEXT NOT NULL,
          ip_address TEXT NOT NULL,
          route_id INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `).run();

      // Indexes
      console.log("Running migrations for indexes");
      db.query(`CREATE INDEX IF NOT EXISTS idx_domains_name ON domains(name);`).run();
      db.query(`CREATE INDEX IF NOT EXISTS idx_routes_domain_service ON routes(domain_id, service_id);`).run();
      db.query(`CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests(created_at);`).run();
      db.query(`CREATE INDEX IF NOT EXISTS idx_requests_service_id ON requests(service_id);`).run();

      // Api keys
      // Temporary until we have a proper auth system
      console.log("Running migrations for api keys");
      db.query(`
        CREATE TABLE IF NOT EXISTS api_keys (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          key TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          revoked_at TEXT
        );
      `).run();

      console.log("Migrations completed");
    }
  });
};