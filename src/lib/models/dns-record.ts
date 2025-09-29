import { Database } from "bun:sqlite";

export interface DNSRecord {
  id?: number;
  domain_id: number;
  name: string;
  type: 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'SRV' | 'PTR';
  value: string;
  ttl: number;
  priority?: number;
  weight?: number;
  source: 'route53' | 'cloud_router';
  created_by_route_id?: number;
  created_at: string;
  updated_at: string;
}

export class DNSRecordModel {
  constructor(private db: Database) {}

  private getCurrentTimestamp = () => new Date().toISOString();

  // Create a new DNS record
  create(data: Omit<DNSRecord, 'id' | 'created_at' | 'updated_at'>): number {
    const timestamp = this.getCurrentTimestamp();
    const stmt = this.db.prepare(`
      INSERT INTO dns_records (
        domain_id, name, type, value, ttl, priority, weight, source, created_by_route_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      data.domain_id,
      data.name,
      data.type,
      data.value,
      data.ttl,
      data.priority ?? null,
      data.weight ?? null,
      data.source,
      data.created_by_route_id ?? null,
      timestamp,
      timestamp
    );

    return result.lastInsertRowid as number;
  }

  // Find DNS record by ID
  findById(id: number): DNSRecord | undefined {
    const stmt = this.db.prepare('SELECT * FROM dns_records WHERE id = ?');
    return stmt.get(id) as DNSRecord | undefined;
  }

  // Find all DNS records for a domain
  findByDomainId(domainId: number): DNSRecord[] {
    const stmt = this.db.prepare('SELECT * FROM dns_records WHERE domain_id = ? ORDER BY name, type');
    return stmt.all(domainId) as DNSRecord[];
  }

  // Find DNS records by route ID
  findByRouteId(routeId: number): DNSRecord[] {
    const stmt = this.db.prepare('SELECT * FROM dns_records WHERE created_by_route_id = ?');
    return stmt.all(routeId) as DNSRecord[];
  }

  // Find DNS record by domain, name, and type (for uniqueness checks)
  findByDomainNameType(domainId: number, name: string, type: string): DNSRecord | undefined {
    const stmt = this.db.prepare('SELECT * FROM dns_records WHERE domain_id = ? AND name = ? AND type = ?');
    return stmt.get(domainId, name, type) as DNSRecord | undefined;
  }

  // Update DNS record
  update(id: number, data: Partial<Omit<DNSRecord, 'id' | 'created_at'>>): boolean {
    const timestamp = this.getCurrentTimestamp();
    const updates = [];
    const values = [];

    const fields = ['domain_id', 'name', 'type', 'value', 'ttl', 'priority', 'weight', 'source', 'created_by_route_id'];
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

    const query = `UPDATE dns_records SET ${updates.join(', ')} WHERE id = ?`;
    const stmt = this.db.prepare(query);
    const result = stmt.run(...values);
    return result.changes > 0;
  }

  // Delete DNS record
  delete(id: number): boolean {
    const stmt = this.db.prepare('DELETE FROM dns_records WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // Delete all DNS records for a domain
  deleteByDomainId(domainId: number): number {
    const stmt = this.db.prepare('DELETE FROM dns_records WHERE domain_id = ?');
    const result = stmt.run(domainId);
    return result.changes;
  }

  // Delete DNS records created by a specific route
  deleteByRouteId(routeId: number): number {
    const stmt = this.db.prepare('DELETE FROM dns_records WHERE created_by_route_id = ?');
    const result = stmt.run(routeId);
    return result.changes;
  }

  // Count DNS records for a domain
  countByDomainId(domainId: number): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM dns_records WHERE domain_id = ?');
    const result = stmt.get(domainId) as { count: number };
    return result.count;
  }

  // Validate DNS record data
  validate(record: Partial<DNSRecord>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!record.name) {
      errors.push('Name is required');
    }

    if (!record.type || !['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'SRV', 'PTR'].includes(record.type)) {
      errors.push('Valid type is required (A, AAAA, CNAME, MX, TXT, SRV, PTR)');
    }

    if (!record.value) {
      errors.push('Value is required');
    }

    if (!record.source || !['route53', 'cloud_router'].includes(record.source)) {
      errors.push('Valid source is required (route53, cloud_router)');
    }

    if (record.ttl !== undefined && (record.ttl < 0 || record.ttl > 604800)) {
      errors.push('TTL must be between 0 and 604800 seconds');
    }

    if (record.priority !== undefined && (record.priority < 0 || record.priority > 65535)) {
      errors.push('Priority must be between 0 and 65535');
    }

    if (record.weight !== undefined && (record.weight < 0 || record.weight > 255)) {
      errors.push('Weight must be between 0 and 255');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Get DNS record types that support priority (MX, SRV)
  static getTypesWithPriority(): string[] {
    return ['MX', 'SRV'];
  }

  // Get DNS record types that support weight (SRV)
  static getTypesWithWeight(): string[] {
    return ['SRV'];
  }
}
