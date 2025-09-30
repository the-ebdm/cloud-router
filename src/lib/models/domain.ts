import { Database } from "bun:sqlite";
import { DNSRecordModel, DNSRecord } from "./dns-record";

export interface Domain {
  id?: number;
  name: string;
  hosted_zone_id?: string;
  delegation_status: 'pending' | 'completed' | 'failed';
  zone_created_at?: string;
  last_synced_at?: string;
  record_count: number;
  created_at: string;
  updated_at: string;
}

export interface DomainWithDNSRecords extends Domain {
  dnsRecords: DNSRecord[];
}

export class DomainModel {
  private dnsRecordModel: DNSRecordModel;

  constructor(private db: Database) {
    this.dnsRecordModel = new DNSRecordModel(db);
  }

  private getCurrentTimestamp = () => new Date().toISOString();

  // Create a new domain
  create(data: Omit<Domain, 'id' | 'created_at' | 'updated_at' | 'record_count'>): number {
    const timestamp = this.getCurrentTimestamp();
    const stmt = this.db.prepare(`
      INSERT INTO domains (
        name, hosted_zone_id, delegation_status, zone_created_at, last_synced_at, record_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      data.name,
      data.hosted_zone_id ?? null,
      data.delegation_status,
      data.zone_created_at ?? null,
      data.last_synced_at ?? null,
      0, // record_count starts at 0
      timestamp,
      timestamp
    );

    return result.lastInsertRowid as number;
  }

  // Find domain by ID
  findById(id: number): Domain | undefined {
    const stmt = this.db.prepare('SELECT * FROM domains WHERE id = ?');
    return stmt.get(id) as Domain | undefined;
  }

  // Find domain by name
  findByName(name: string): Domain | undefined {
    const stmt = this.db.prepare('SELECT * FROM domains WHERE name = ?');
    return stmt.get(name) as Domain | undefined;
  }

  // Find domain by hosted zone ID
  findByHostedZoneId(hostedZoneId: string): Domain | undefined {
    const stmt = this.db.prepare('SELECT * FROM domains WHERE hosted_zone_id = ?');
    return stmt.get(hostedZoneId) as Domain | undefined;
  }

  // Get all domains
  findAll(): Domain[] {
    const stmt = this.db.prepare('SELECT * FROM domains ORDER BY name');
    return stmt.all() as Domain[];
  }

  // Get domain with DNS records
  findByIdWithDNSRecords(id: number): DomainWithDNSRecords | undefined {
    const domain = this.findById(id);
    if (!domain) return undefined;

    const dnsRecords = this.dnsRecordModel.findByDomainId(id);
    return {
      ...domain,
      dnsRecords
    };
  }

  // Update domain
  update(id: number, data: Partial<Omit<Domain, 'id' | 'created_at'>>): boolean {
    const timestamp = this.getCurrentTimestamp();
    const updates = [];
    const values = [];

    const fields = ['name', 'hosted_zone_id', 'delegation_status', 'zone_created_at', 'last_synced_at', 'record_count'];
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

    const query = `UPDATE domains SET ${updates.join(', ')} WHERE id = ?`;
    const stmt = this.db.prepare(query);
    const result = stmt.run(...values);
    return result.changes > 0;
  }

  // Update record count for domain
  updateRecordCount(id: number): boolean {
    const count = this.dnsRecordModel.countByDomainId(id);
    return this.update(id, { record_count: count });
  }

  // Update last synced timestamp
  updateLastSynced(id: number): boolean {
    return this.update(id, { last_synced_at: this.getCurrentTimestamp() });
  }

  // Set delegation status
  setDelegationStatus(id: number, status: 'pending' | 'completed' | 'failed'): boolean {
    return this.update(id, { delegation_status: status });
  }

  // Set hosted zone ID
  setHostedZoneId(id: number, hostedZoneId: string, zoneCreatedAt?: string): boolean {
    const updateData: Partial<Domain> = { hosted_zone_id: hostedZoneId };
    if (zoneCreatedAt) {
      updateData.zone_created_at = zoneCreatedAt;
    }
    return this.update(id, updateData);
  }

  // Delete domain
  delete(id: number): boolean {
    // First delete all DNS records for this domain
    this.dnsRecordModel.deleteByDomainId(id);

    // Then delete the domain
    const stmt = this.db.prepare('DELETE FROM domains WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // Check if domain exists by name
  existsByName(name: string): boolean {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM domains WHERE name = ?');
    const result = stmt.get(name) as { count: number };
    return result.count > 0;
  }

  // Validate domain data
  validate(domain: Partial<Domain>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!domain.name) {
      errors.push('Name is required');
    } else {
      // Basic domain name validation
      const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/;
      if (!domainRegex.test(domain.name)) {
        errors.push('Invalid domain name format');
      }
    }

    if (domain.delegation_status && !['pending', 'completed', 'failed'].includes(domain.delegation_status)) {
      errors.push('Delegation status must be pending, completed, or failed');
    }

    if (domain.record_count !== undefined && domain.record_count < 0) {
      errors.push('Record count cannot be negative');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Get domains that need DNS sync (no last_synced_at or very old)
  getDomainsNeedingSync(hoursOld: number = 24): Domain[] {
    const cutoffTime = new Date(Date.now() - (hoursOld * 60 * 60 * 1000)).toISOString();
    const stmt = this.db.prepare(`
      SELECT * FROM domains
      WHERE last_synced_at IS NULL OR last_synced_at < ?
      ORDER BY last_synced_at ASC NULLS FIRST
    `);
    return stmt.all(cutoffTime) as Domain[];
  }

  // Get domains by delegation status
  getDomainsByDelegationStatus(status: 'pending' | 'completed' | 'failed'): Domain[] {
    const stmt = this.db.prepare('SELECT * FROM domains WHERE delegation_status = ? ORDER BY name');
    return stmt.all(status) as Domain[];
  }
}
