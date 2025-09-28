import { Database } from "bun:sqlite";

const db = new Database("database.sqlite");

const getCurrentTimestamp = () => new Date().toISOString();

// Interfaces based on schema
interface Domain {
  id?: number;
  name: string;
  hosted_zone_id?: string;
  created_at: string;
  updated_at: string;
}

interface Certificate {
  id?: number;
  domain_id: number;
  path: string;
  is_active: boolean;
  is_wildcard: boolean;
  is_custom_domain: boolean;
  is_dedicated_subdomain: boolean;
  is_path: boolean;
  is_redirect: boolean;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

interface Service {
  id?: number;
  domain_id: number;
  name: string;
  description: string;
  port: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface HealthCheck {
  id?: number;
  service_id: number;
  path: string;
  interval: number;
  timeout: number;
  threshold: number;
  failure_threshold: number;
  success_threshold: number;
  status_code: number;
  created_at: string;
  updated_at: string;
}

interface HealthCheckInvocation {
  id?: number;
  health_check_id: number;
  status: string;
  response_time: number;
  created_at: string;
  updated_at: string;
}

interface Route {
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

interface RequestLog {
  id?: number;
  service_id: number;
  url: string;
  method: string;
  status: string;
  response_time: number;
  user_agent: string;
  ip_address: string;
  route_id: number;
  created_at: string;
  updated_at: string;
}

interface ApiKey {
  id?: number;
  key: string;
  created_at: string;
  updated_at: string;
  revoked_at?: string;
}

// CRUD for Domains
export const createDomain = (data: Omit<Domain, 'id' | 'created_at' | 'updated_at'>): number => {
  const timestamp = getCurrentTimestamp();
  const hostedZoneId = data.hosted_zone_id ?? null;
  const stmt = db.prepare(`
    INSERT INTO domains (name, hosted_zone_id, created_at, updated_at)
    VALUES (?, ?, ?, ?)
  `);
  const result = stmt.run(data.name, hostedZoneId, timestamp, timestamp);
  return result.lastInsertRowid as number;
};

export const getDomainById = (id: number): Domain | undefined => {
  const stmt = db.prepare('SELECT * FROM domains WHERE id = ?');
  return stmt.get(id) as Domain | undefined;
};

export const getAllDomains = (): Domain[] => {
  const stmt = db.prepare('SELECT * FROM domains');
  return stmt.all() as Domain[];
};

export const updateDomain = (id: number, data: Partial<Omit<Domain, 'id' | 'created_at'>>): boolean => {
  const timestamp = getCurrentTimestamp();
  const updates = [];
  const values = [];
  if (data.name !== undefined) {
    updates.push('name = ?');
    values.push(data.name);
  }
  if (data.hosted_zone_id !== undefined) {
    updates.push('hosted_zone_id = ?');
    values.push(data.hosted_zone_id);
  }
  if (updates.length === 0) return false;
  updates.push('updated_at = ?');
  values.push(timestamp);
  values.unshift(id);
  const query = `UPDATE domains SET ${updates.join(', ')} WHERE id = ?`;
  const stmt = db.prepare(query);
  const result = stmt.run(...values);
  return result.changes > 0;
};

export const deleteDomain = (id: number): boolean => {
  const stmt = db.prepare('DELETE FROM domains WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
};

// CRUD for Certificates
export const createCertificate = (data: Omit<Certificate, 'id' | 'created_at' | 'updated_at'>): number => {
  const timestamp = getCurrentTimestamp();
  const stmt = db.prepare(`
    INSERT INTO certificates (domain_id, path, is_active, is_wildcard, is_custom_domain, is_dedicated_subdomain, is_path, is_redirect, expires_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(data.domain_id, data.path, data.is_active, data.is_wildcard, data.is_custom_domain, data.is_dedicated_subdomain, data.is_path, data.is_redirect, data.expires_at, timestamp, timestamp);
  return result.lastInsertRowid as number;
};

export const getCertificateById = (id: number): Certificate | undefined => {
  const stmt = db.prepare('SELECT * FROM certificates WHERE id = ?');
  return stmt.get(id) as Certificate | undefined;
};

export const getAllCertificates = (): Certificate[] => {
  const stmt = db.prepare('SELECT * FROM certificates');
  return stmt.all() as Certificate[];
};

export const updateCertificate = (id: number, data: Partial<Omit<Certificate, 'id' | 'created_at'>>): boolean => {
  const timestamp = getCurrentTimestamp();
  const updates = [];
  const values = [];
  const fields = ['domain_id', 'path', 'is_active', 'is_wildcard', 'is_custom_domain', 'is_dedicated_subdomain', 'is_path', 'is_redirect', 'expires_at'];
  fields.forEach(field => {
    if (data[field as keyof typeof data] !== undefined) {
      updates.push(`${field} = ?`);
      values.push((data as any)[field]);
    }
  });
  if (updates.length === 0) return false;
  updates.push('updated_at = ?');
  values.push(timestamp);
  values.unshift(id);
  const query = `UPDATE certificates SET ${updates.join(', ')} WHERE id = ?`;
  const stmt = db.prepare(query);
  const result = stmt.run(...values);
  return result.changes > 0;
};

export const deleteCertificate = (id: number): boolean => {
  const stmt = db.prepare('DELETE FROM certificates WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
};

// CRUD for Services
export const createService = (data: Omit<Service, 'id' | 'created_at' | 'updated_at'>): number => {
  const timestamp = getCurrentTimestamp();
  const stmt = db.prepare(`
    INSERT INTO services (domain_id, name, description, port, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(data.domain_id, data.name, data.description, data.port, data.is_active, timestamp, timestamp);
  return result.lastInsertRowid as number;
};

export const getServiceById = (id: number): Service | undefined => {
  const stmt = db.prepare('SELECT * FROM services WHERE id = ?');
  return stmt.get(id) as Service | undefined;
};

export const getAllServices = (): Service[] => {
  const stmt = db.prepare('SELECT * FROM services');
  return stmt.all() as Service[];
};

export const updateService = (id: number, data: Partial<Omit<Service, 'id' | 'created_at'>>): boolean => {
  const timestamp = getCurrentTimestamp();
  const updates = [];
  const values = [];
  const fields = ['domain_id', 'name', 'description', 'port', 'is_active'];
  fields.forEach(field => {
    if (data[field as keyof typeof data] !== undefined) {
      updates.push(`${field} = ?`);
      values.push((data as any)[field]);
    }
  });
  if (updates.length === 0) return false;
  updates.push('updated_at = ?');
  values.push(timestamp);
  values.unshift(id);
  const query = `UPDATE services SET ${updates.join(', ')} WHERE id = ?`;
  const stmt = db.prepare(query);
  const result = stmt.run(...values);
  return result.changes > 0;
};

export const deleteService = (id: number): boolean => {
  const stmt = db.prepare('DELETE FROM services WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
};

// CRUD for HealthChecks
export const createHealthCheck = (data: Omit<HealthCheck, 'id' | 'created_at' | 'updated_at'>): number => {
  const timestamp = getCurrentTimestamp();
  const stmt = db.prepare(`
    INSERT INTO health_checks (service_id, path, interval, timeout, threshold, failure_threshold, success_threshold, status_code, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(data.service_id, data.path, data.interval, data.timeout, data.threshold, data.failure_threshold, data.success_threshold, data.status_code, timestamp, timestamp);
  return result.lastInsertRowid as number;
};

export const getHealthCheckById = (id: number): HealthCheck | undefined => {
  const stmt = db.prepare('SELECT * FROM health_checks WHERE id = ?');
  return stmt.get(id) as HealthCheck | undefined;
};

export const getAllHealthChecks = (): HealthCheck[] => {
  const stmt = db.prepare('SELECT * FROM health_checks');
  return stmt.all() as HealthCheck[];
};

export const updateHealthCheck = (id: number, data: Partial<Omit<HealthCheck, 'id' | 'created_at'>>): boolean => {
  const timestamp = getCurrentTimestamp();
  const updates = [];
  const values = [];
  const fields = ['service_id', 'path', 'interval', 'timeout', 'threshold', 'failure_threshold', 'success_threshold', 'status_code'];
  fields.forEach(field => {
    if (data[field as keyof typeof data] !== undefined) {
      updates.push(`${field} = ?`);
      values.push((data as any)[field]);
    }
  });
  if (updates.length === 0) return false;
  updates.push('updated_at = ?');
  values.push(timestamp);
  values.unshift(id);
  const query = `UPDATE health_checks SET ${updates.join(', ')} WHERE id = ?`;
  const stmt = db.prepare(query);
  const result = stmt.run(...values);
  return result.changes > 0;
};

export const deleteHealthCheck = (id: number): boolean => {
  const stmt = db.prepare('DELETE FROM health_checks WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
};

// CRUD for HealthCheckInvocations
export const createHealthCheckInvocation = (data: Omit<HealthCheckInvocation, 'id' | 'created_at' | 'updated_at'>): number => {
  const timestamp = getCurrentTimestamp();
  const stmt = db.prepare(`
    INSERT INTO health_check_invocations (health_check_id, status, response_time, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  const result = stmt.run(data.health_check_id, data.status, data.response_time, timestamp, timestamp);
  return result.lastInsertRowid as number;
};

export const getHealthCheckInvocationById = (id: number): HealthCheckInvocation | undefined => {
  const stmt = db.prepare('SELECT * FROM health_check_invocations WHERE id = ?');
  return stmt.get(id) as HealthCheckInvocation | undefined;
};

export const getAllHealthCheckInvocations = (): HealthCheckInvocation[] => {
  const stmt = db.prepare('SELECT * FROM health_check_invocations');
  return stmt.all() as HealthCheckInvocation[];
};

export const updateHealthCheckInvocation = (id: number, data: Partial<Omit<HealthCheckInvocation, 'id' | 'created_at'>>): boolean => {
  const timestamp = getCurrentTimestamp();
  const updates = [];
  const values = [];
  const fields = ['health_check_id', 'status', 'response_time'];
  fields.forEach(field => {
    if (data[field as keyof typeof data] !== undefined) {
      updates.push(`${field} = ?`);
      values.push((data as any)[field]);
    }
  });
  if (updates.length === 0) return false;
  updates.push('updated_at = ?');
  values.push(timestamp);
  values.unshift(id);
  const query = `UPDATE health_check_invocations SET ${updates.join(', ')} WHERE id = ?`;
  const stmt = db.prepare(query);
  const result = stmt.run(...values);
  return result.changes > 0;
};

export const deleteHealthCheckInvocation = (id: number): boolean => {
  const stmt = db.prepare('DELETE FROM health_check_invocations WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
};

// CRUD for Routes
export const createRoute = (data: Omit<Route, 'id' | 'created_at' | 'updated_at'>): number => {
  const timestamp = getCurrentTimestamp();
  const stmt = db.prepare(`
    INSERT INTO routes (domain_id, service_id, path, is_active, is_dedicated_subdomain, is_path, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(data.domain_id, data.service_id, data.path, data.is_active, data.is_dedicated_subdomain, data.is_path, timestamp, timestamp);
  return result.lastInsertRowid as number;
};

export const getRouteById = (id: number): Route | undefined => {
  const stmt = db.prepare('SELECT * FROM routes WHERE id = ?');
  return stmt.get(id) as Route | undefined;
};

export const getAllRoutes = (): Route[] => {
  const stmt = db.prepare('SELECT * FROM routes');
  return stmt.all() as Route[];
};

export const updateRoute = (id: number, data: Partial<Omit<Route, 'id' | 'created_at'>>): boolean => {
  const timestamp = getCurrentTimestamp();
  const updates = [];
  const values = [];
  const fields = ['domain_id', 'service_id', 'path', 'is_active', 'is_dedicated_subdomain', 'is_path'];
  fields.forEach(field => {
    if (data[field as keyof typeof data] !== undefined) {
      updates.push(`${field} = ?`);
      values.push((data as any)[field]);
    }
  });
  if (updates.length === 0) return false;
  updates.push('updated_at = ?');
  values.push(timestamp);
  values.unshift(id);
  const query = `UPDATE routes SET ${updates.join(', ')} WHERE id = ?`;
  const stmt = db.prepare(query);
  const result = stmt.run(...values);
  return result.changes > 0;
};

export const deleteRoute = (id: number): boolean => {
  const stmt = db.prepare('DELETE FROM routes WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
};

// CRUD for Requests (logs)
export const createRequestLog = (data: Omit<RequestLog, 'id' | 'created_at' | 'updated_at'>): number => {
  const timestamp = getCurrentTimestamp();
  const stmt = db.prepare(`
    INSERT INTO requests (service_id, url, method, status, response_time, user_agent, ip_address, route_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(data.service_id, data.url, data.method, data.status, data.response_time, data.user_agent, data.ip_address, data.route_id, timestamp, timestamp);
  return result.lastInsertRowid as number;
};

export const getRequestLogById = (id: number): RequestLog | undefined => {
  const stmt = db.prepare('SELECT * FROM requests WHERE id = ?');
  return stmt.get(id) as RequestLog | undefined;
};

export const getAllRequestLogs = (): RequestLog[] => {
  const stmt = db.prepare('SELECT * FROM requests');
  return stmt.all() as RequestLog[];
};

export const updateRequestLog = (id: number, data: Partial<Omit<RequestLog, 'id' | 'created_at'>>): boolean => {
  const timestamp = getCurrentTimestamp();
  const updates = [];
  const values = [];
  const fields = ['service_id', 'url', 'method', 'status', 'response_time', 'user_agent', 'ip_address', 'route_id'];
  fields.forEach(field => {
    if (data[field as keyof typeof data] !== undefined) {
      updates.push(`${field} = ?`);
      values.push((data as any)[field]);
    }
  });
  if (updates.length === 0) return false;
  updates.push('updated_at = ?');
  values.push(timestamp);
  values.unshift(id);
  const query = `UPDATE requests SET ${updates.join(', ')} WHERE id = ?`;
  const stmt = db.prepare(query);
  const result = stmt.run(...values);
  return result.changes > 0;
};

export const deleteRequestLog = (id: number): boolean => {
  const stmt = db.prepare('DELETE FROM requests WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
};

// CRUD for ApiKeys
export const createApiKey = (data: Omit<ApiKey, 'id' | 'created_at' | 'updated_at' | 'revoked_at'>): number => {
  const timestamp = getCurrentTimestamp();
  const stmt = db.prepare(`
    INSERT INTO api_keys (key, created_at, updated_at)
    VALUES (?, ?, ?)
  `);
  const result = stmt.run(data.key, timestamp, timestamp);
  return result.lastInsertRowid as number;
};

export const getApiKeyById = (id: number): ApiKey | undefined => {
  const stmt = db.prepare('SELECT * FROM api_keys WHERE id = ?');
  return stmt.get(id) as ApiKey | undefined;
};

export const getAllApiKeys = (): ApiKey[] => {
  const stmt = db.prepare('SELECT * FROM api_keys');
  return stmt.all() as ApiKey[];
};

// Lookup API key by the key string
export const getApiKeyByKey = (key: string): ApiKey | undefined => {
  const stmt = db.prepare('SELECT * FROM api_keys WHERE key = ?');
  return stmt.get(key) as ApiKey | undefined;
};

export const updateApiKey = (id: number, data: Partial<Omit<ApiKey, 'id' | 'created_at'>>): boolean => {
  const timestamp = getCurrentTimestamp();
  const updates = [];
  const values = [];
  if (data.key !== undefined) {
    updates.push('key = ?');
    values.push(data.key);
  }
  if (data.revoked_at !== undefined) {
    updates.push('revoked_at = ?');
    values.push(data.revoked_at);
  }
  if (updates.length === 0) return false;
  updates.push('updated_at = ?');
  values.push(timestamp);
  values.unshift(id);
  const query = `UPDATE api_keys SET ${updates.join(', ')} WHERE id = ?`;
  const stmt = db.prepare(query);
  const result = stmt.run(...values);
  return result.changes > 0;
};

export const deleteApiKey = (id: number): boolean => {
  const stmt = db.prepare('DELETE FROM api_keys WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
};

// Export db for direct queries if needed
export default db;