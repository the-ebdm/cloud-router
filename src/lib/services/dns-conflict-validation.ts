import { DNSRecordModel, DNSRecord } from '../models/dns-record';
import { DomainModel } from '../models/domain';

export interface DNSConflict {
  type: 'duplicate_name' | 'cname_conflict' | 'ttl_mismatch' | 'value_conflict';
  severity: 'error' | 'warning' | 'info';
  record: DNSRecord;
  conflictingRecords: DNSRecord[];
  description: string;
  resolution: string;
}

export interface DNSValidationResult {
  valid: boolean;
  conflicts: DNSConflict[];
  warnings: string[];
}

export interface DNSRecordValidationOptions {
  domainId: number;
  name: string;
  type: string;
  value: string;
  ttl?: number;
  checkExisting?: boolean;
  strictMode?: boolean;
}

export class DNSConflictValidationService {
  constructor(
    private dnsRecordModel: DNSRecordModel,
    private domainModel: DomainModel
  ) { }

  /**
   * Validate a DNS record for conflicts
   */
  async validateDNSRecord(options: DNSRecordValidationOptions): Promise<DNSValidationResult> {
    const { domainId, name, type, value, ttl, checkExisting = true, strictMode = false } = options;
    const conflicts: DNSConflict[] = [];
    const warnings: string[] = [];

    try {
      // Validate domain exists
      const domain = this.domainModel.findById(domainId);
      if (!domain) {
        return {
          valid: false,
          conflicts: [{
            type: 'duplicate_name',
            severity: 'error',
            record: {} as DNSRecord, // Placeholder
            conflictingRecords: [],
            description: `Domain with ID ${domainId} not found`,
            resolution: 'Ensure domain exists before creating DNS records',
          }],
          warnings: [],
        };
      }

      // Get existing records for validation
      const existingRecords = checkExisting ? this.dnsRecordModel.findByDomainId(domainId) : [];

      // Check for duplicate names (same name, any type)
      const duplicateNames = existingRecords.filter(record => record.name === name);
      if (duplicateNames.length > 0) {
        conflicts.push({
          type: 'duplicate_name',
          severity: 'error',
          record: { name, type: type as any, value } as DNSRecord,
          conflictingRecords: duplicateNames,
          description: `DNS record name '${name}' already exists with types: ${duplicateNames.map(r => r.type).join(', ')}`,
          resolution: 'Use a different name or update existing record',
        });
      }

      // CNAME conflict validation
      if (type === 'CNAME') {
        const cnameConflicts = this.validateCNAMEConflicts(name, existingRecords);
        conflicts.push(...cnameConflicts);
      } else {
        // Check if a CNAME already exists for this name
        const existingCNAME = existingRecords.find(record => record.name === name && record.type === 'CNAME');
        if (existingCNAME) {
          conflicts.push({
            type: 'cname_conflict',
            severity: 'error',
            record: { name, type: type as any, value } as DNSRecord,
            conflictingRecords: [existingCNAME],
            description: `CNAME record already exists for '${name}', cannot add other record types`,
            resolution: 'Remove the CNAME record first or use a different name',
          });
        }
      }

      // TTL consistency warnings (for same name records)
      if (ttl !== undefined && duplicateNames.length > 0) {
        const ttlMismatches = duplicateNames.filter(record => record.ttl !== ttl);
        if (ttlMismatches.length > 0) {
          conflicts.push({
            type: 'ttl_mismatch',
            severity: strictMode ? 'error' : 'warning',
            record: { name, type: type as any, value, ttl } as DNSRecord,
            conflictingRecords: ttlMismatches,
            description: `TTL mismatch: new TTL ${ttl}s differs from existing records (${ttlMismatches.map(r => `${r.type}:${r.ttl}s`).join(', ')})`,
            resolution: 'Consider using consistent TTL values for records with the same name',
          });
        }
      }

      // Value conflict detection (for same type records)
      const sameTypeRecords = existingRecords.filter(record => record.name === name && record.type === type);
      if (sameTypeRecords.length > 0) {
        // For most record types, multiple records with same name/type are allowed
        // But warn if values are identical (potential duplicate)
        const duplicateValues = sameTypeRecords.filter(record => record.value === value);
        if (duplicateValues.length > 0) {
          conflicts.push({
            type: 'value_conflict',
            severity: 'warning',
            record: { name, type: type as any, value } as DNSRecord,
            conflictingRecords: duplicateValues,
            description: `Identical record already exists: ${name} ${type} ${value}`,
            resolution: 'This will create a duplicate record, consider updating existing instead',
          });
        }
      }

      // Type-specific validations
      const typeValidation = this.validateRecordTypeSpecific(name, type, value);
      conflicts.push(...typeValidation.conflicts);
      warnings.push(...typeValidation.warnings);

      // Determine overall validity
      const hasErrors = conflicts.some(conflict => conflict.severity === 'error');
      const valid = !hasErrors;

      return {
        valid,
        conflicts,
        warnings,
      };

    } catch (error) {
      return {
        valid: false,
        conflicts: [{
          type: 'duplicate_name',
          severity: 'error',
          record: {} as DNSRecord,
          conflictingRecords: [],
          description: `Validation failed: ${error}`,
          resolution: 'Check validation logic and try again',
        }],
        warnings: [],
      };
    }
  }

  /**
   * Validate CNAME conflicts
   */
  private validateCNAMEConflicts(name: string, existingRecords: DNSRecord[]): DNSConflict[] {
    const conflicts: DNSConflict[] = [];

    // Find other records with the same name
    const conflictingRecords = existingRecords.filter(record =>
      record.name === name && record.type !== 'CNAME'
    );

    if (conflictingRecords.length > 0) {
      conflicts.push({
        type: 'cname_conflict',
        severity: 'error',
        record: { name, type: 'CNAME' } as DNSRecord,
        conflictingRecords,
        description: `Cannot create CNAME record for '${name}' - other records exist: ${conflictingRecords.map(r => r.type).join(', ')}`,
        resolution: 'Remove conflicting records first or use a different name',
      });
    }

    return conflicts;
  }

  /**
   * Type-specific validation
   */
  private validateRecordTypeSpecific(name: string, type: string, value: string): { conflicts: DNSConflict[], warnings: string[] } {
    const conflicts: DNSConflict[] = [];
    const warnings: string[] = [];

    switch (type) {
      case 'A':
        if (!this.isValidIPv4(value)) {
          conflicts.push({
            type: 'value_conflict',
            severity: 'error',
            record: { name, type: 'A', value } as DNSRecord,
            conflictingRecords: [],
            description: `Invalid IPv4 address: ${value}`,
            resolution: 'Provide a valid IPv4 address (e.g., 192.168.1.1)',
          });
        }
        break;

      case 'AAAA':
        if (!this.isValidIPv6(value)) {
          conflicts.push({
            type: 'value_conflict',
            severity: 'error',
            record: { name, type: 'AAAA', value } as DNSRecord,
            conflictingRecords: [],
            description: `Invalid IPv6 address: ${value}`,
            resolution: 'Provide a valid IPv6 address',
          });
        }
        break;

      case 'CNAME':
        if (!this.isValidDomainName(value)) {
          conflicts.push({
            type: 'value_conflict',
            severity: 'error',
            record: { name, type: 'CNAME', value } as DNSRecord,
            conflictingRecords: [],
            description: `Invalid domain name for CNAME: ${value}`,
            resolution: 'Provide a valid fully qualified domain name',
          });
        }
        break;

      case 'MX':
        const mxParts = value.split(' ');
        if (mxParts.length !== 2 || !this.isValidDomainName(mxParts[1])) {
          conflicts.push({
            type: 'value_conflict',
            severity: 'error',
            record: { name, type: 'MX', value } as DNSRecord,
            conflictingRecords: [],
            description: `Invalid MX record format: ${value}`,
            resolution: 'Use format: "priority mailserver.example.com" (e.g., "10 mail.example.com")',
          });
        }
        break;

      case 'SRV':
        const srvParts = value.split(' ');
        if (srvParts.length !== 4) {
          conflicts.push({
            type: 'value_conflict',
            severity: 'error',
            record: { name, type: 'SRV', value } as DNSRecord,
            conflictingRecords: [],
            description: `Invalid SRV record format: ${value}`,
            resolution: 'Use format: "priority weight port target" (e.g., "10 5 443 service.example.com")',
          });
        } else {
          const [priority, weight, port, target] = srvParts;
          if (!this.isValidDomainName(target)) {
            conflicts.push({
              type: 'value_conflict',
              severity: 'error',
              record: { name, type: 'SRV', value } as DNSRecord,
              conflictingRecords: [],
              description: `Invalid target domain in SRV record: ${target}`,
              resolution: 'Provide a valid target domain name',
            });
          }
        }
        break;

      case 'TXT':
        // TXT records can contain any text, but warn about very long values
        if (value.length > 255) {
          warnings.push(`TXT record value is ${value.length} characters long, which may cause issues with some DNS resolvers`);
        }
        break;
    }

    return { conflicts, warnings };
  }

  /**
   * Validate IPv4 address
   */
  private isValidIPv4(ip: string): boolean {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipv4Regex.test(ip);
  }

  /**
   * Validate IPv6 address
   */
  private isValidIPv6(ip: string): boolean {
    const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){2,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){3,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){4,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
    return ipv6Regex.test(ip);
  }

  /**
   * Validate domain name
   */
  private isValidDomainName(domain: string): boolean {
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/;
    return domainRegex.test(domain.replace(/\.$/, ''));
  }

  /**
   * Resolve conflicts with suggested actions
   */
  resolveConflicts(conflicts: DNSConflict[]): {
    canAutoResolve: boolean;
    actions: Array<{
      type: 'skip' | 'update' | 'delete' | 'manual';
      conflict: DNSConflict;
      description: string;
    }>;
  } {
    const actions: Array<{
      type: 'skip' | 'update' | 'delete' | 'manual';
      conflict: DNSConflict;
      description: string;
    }> = [];

    let canAutoResolve = true;

    for (const conflict of conflicts) {
      switch (conflict.type) {
        case 'duplicate_name':
          if (conflict.severity === 'error') {
            actions.push({
              type: 'manual',
              conflict,
              description: 'Manual review required for duplicate names',
            });
            canAutoResolve = false;
          }
          break;

        case 'cname_conflict':
          actions.push({
            type: 'delete',
            conflict,
            description: 'Remove conflicting CNAME record',
          });
          break;

        case 'ttl_mismatch':
          actions.push({
            type: 'skip',
            conflict,
            description: 'TTL mismatch is informational only',
          });
          break;

        case 'value_conflict':
          actions.push({
            type: 'update',
            conflict,
            description: 'Update existing record instead of creating duplicate',
          });
          break;
      }
    }

    return { canAutoResolve, actions };
  }
}
