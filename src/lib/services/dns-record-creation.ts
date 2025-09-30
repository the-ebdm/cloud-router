import { Route53ClientService, DNSRecordData } from './route53-client';
import { DNSRecordModel, DNSRecord } from '../models/dns-record';
import { DomainModel } from '../models/domain';

export interface DNSRecordCreationOptions {
  domainId: number;
  name: string;
  type: 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'SRV' | 'PTR';
  value: string;
  ttl?: number;
  priority?: number;
  weight?: number;
  syncToRoute53?: boolean;
}

export interface DNSRecordCreationResult {
  success: boolean;
  recordId?: number;
  route53ChangeId?: string;
  error?: string;
  warnings: string[];
}

export class DNSRecordCreationService {
  constructor(
    private route53Client: Route53ClientService,
    private dnsRecordModel: DNSRecordModel,
    private domainModel: DomainModel
  ) { }

  /**
   * Create a DNS record both locally and optionally in Route53
   */
  async createDNSRecord(options: DNSRecordCreationOptions): Promise<DNSRecordCreationResult> {
    const {
      domainId,
      name,
      type,
      value,
      ttl = 300,
      priority,
      weight,
      syncToRoute53 = true,
    } = options;

    const warnings: string[] = [];

    try {
      // Validate domain exists
      const domain = this.domainModel.findById(domainId);
      if (!domain) {
        return {
          success: false,
          error: `Domain with ID ${domainId} not found`,
          warnings: [],
        };
      }

      if (!domain.hosted_zone_id) {
        return {
          success: false,
          error: `Domain ${domain.name} has no hosted zone ID`,
          warnings: [],
        };
      }

      // Validate record data
      const validation = this.validateDNSRecordCreation({
        domainId,
        name,
        type,
        value,
        ttl,
        priority,
        weight,
      });

      if (!validation.valid) {
        return {
          success: false,
          error: validation.errors.join(', '),
          warnings: [],
        };
      }

      // Check for conflicts
      const existingRecord = this.dnsRecordModel.findByDomainNameType(domainId, name, type);
      if (existingRecord) {
        return {
          success: false,
          error: `DNS record ${name} (${type}) already exists for this domain`,
          warnings: [],
        };
      }

      // Create record locally first
      const recordId = this.dnsRecordModel.create({
        domain_id: domainId,
        name,
        type,
        value,
        ttl,
        priority,
        weight,
        source: 'cloud_router',
      });

      let route53ChangeId: string | undefined;

      // Sync to Route53 if requested
      if (syncToRoute53) {
        try {
          const route53Record: DNSRecordData = {
            name,
            type,
            value,
            ttl,
            priority,
            weight,
          };

          await this.route53Client.upsertDNSRecords(domain.hosted_zone_id, [route53Record]);
          // Note: Route53 doesn't return a change ID for upsert operations
          // In a production system, you might want to track this differently

        } catch (route53Error) {
          // If Route53 sync fails, we should probably delete the local record
          // to maintain consistency
          this.dnsRecordModel.delete(recordId);

          return {
            success: false,
            error: `Failed to sync to Route53: ${route53Error}`,
            warnings: [],
          };
        }
      }

      // Update domain record count
      this.domainModel.updateRecordCount(domainId);

      return {
        success: true,
        recordId,
        route53ChangeId,
        warnings,
      };

    } catch (error) {
      return {
        success: false,
        error: `Failed to create DNS record: ${error}`,
        warnings: [],
      };
    }
  }

  /**
   * Create multiple DNS records in batch
   */
  async createDNSRecordsBatch(
    records: DNSRecordCreationOptions[]
  ): Promise<Map<number, DNSRecordCreationResult>> {
    const results = new Map<number, DNSRecordCreationResult>();

    // Group records by domain for efficiency
    const recordsByDomain = new Map<number, Array<DNSRecordCreationOptions & { _index: number }>>();
    records.forEach((record, index) => {
      if (!recordsByDomain.has(record.domainId)) {
        recordsByDomain.set(record.domainId, []);
      }
      recordsByDomain.get(record.domainId)!.push({ ...record, _index: index });
    });

    // Process each domain's records
    for (const [domainId, domainRecords] of recordsByDomain) {
      try {
        const domain = this.domainModel.findById(domainId);
        if (!domain || !domain.hosted_zone_id) {
          // Mark all records for this domain as failed
          domainRecords.forEach((record) => {
            results.set((record as any)._index, {
              success: false,
              error: `Invalid domain or missing hosted zone`,
              warnings: [],
            });
          });
          continue;
        }

        // Validate all records for this domain first
        const validRecords: DNSRecordCreationOptions[] = [];
        const validationErrors: Array<{ index: number; errors: string[] }> = [];

        domainRecords.forEach((record, localIndex) => {
          const validation = this.validateDNSRecordCreation(record);
          if (validation.valid) {
            validRecords.push(record);
          } else {
            validationErrors.push({
              index: (record as any)._index,
              errors: validation.errors,
            });
          }
        });

        // Create valid records in Route53 first (batch operation)
        if (validRecords.length > 0 && domainRecords.some(r => r.syncToRoute53 !== false)) {
          const route53Records: DNSRecordData[] = validRecords
            .filter(r => r.syncToRoute53 !== false)
            .map(record => ({
              name: record.name,
              type: record.type,
              value: record.value,
              ttl: record.ttl || 300,
              priority: record.priority,
              weight: record.weight,
            }));

          if (route53Records.length > 0) {
            try {
              await this.route53Client.upsertDNSRecords(domain.hosted_zone_id!, route53Records);
            } catch (route53Error) {
              // If Route53 batch fails, mark all records as failed
              domainRecords.forEach((record) => {
                results.set((record as any)._index, {
                  success: false,
                  error: `Route53 batch operation failed: ${route53Error}`,
                  warnings: [],
                });
              });
              continue;
            }
          }
        }

        // Create valid records locally
        validRecords.forEach((record) => {
          try {
            const recordId = this.dnsRecordModel.create({
              domain_id: domainId,
              name: record.name,
              type: record.type,
              value: record.value,
              ttl: record.ttl || 300,
              priority: record.priority,
              weight: record.weight,
              source: 'cloud_router',
            });

            results.set((record as any)._index, {
              success: true,
              recordId,
              warnings: [],
            });
          } catch (localError) {
            results.set((record as any)._index, {
              success: false,
              error: `Failed to create local record: ${localError}`,
              warnings: [],
            });
          }
        });

        // Mark validation failures
        validationErrors.forEach(({ index, errors }) => {
          results.set(index, {
            success: false,
            error: errors.join(', '),
            warnings: [],
          });
        });

        // Update domain record count
        this.domainModel.updateRecordCount(domainId);

      } catch (error) {
        // Mark all records for this domain as failed
        domainRecords.forEach((record) => {
          results.set((record as any)._index, {
            success: false,
            error: `Domain processing failed: ${error}`,
            warnings: [],
          });
        });
      }
    }

    return results;
  }

  /**
   * Validate DNS record creation options
   */
  private validateDNSRecordCreation(options: DNSRecordCreationOptions): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Basic validations
    if (!options.name) {
      errors.push('Record name is required');
    }

    if (!options.type || !['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'SRV', 'PTR'].includes(options.type)) {
      errors.push('Valid record type is required');
    }

    if (!options.value) {
      errors.push('Record value is required');
    }

    // Type-specific validations
    switch (options.type) {
      case 'A':
        if (!this.isValidIPv4(options.value)) {
          errors.push('A record must contain a valid IPv4 address');
        }
        break;
      case 'AAAA':
        if (!this.isValidIPv6(options.value)) {
          errors.push('AAAA record must contain a valid IPv6 address');
        }
        break;
      case 'CNAME':
        if (!this.isValidDomainName(options.value)) {
          errors.push('CNAME record must contain a valid domain name');
        }
        break;
      case 'MX':
        if (options.priority === undefined || options.priority < 0 || options.priority > 65535) {
          errors.push('MX record requires a valid priority (0-65535)');
        }
        if (!this.isValidDomainName(options.value)) {
          errors.push('MX record must contain a valid domain name');
        }
        break;
      case 'SRV':
        if (options.priority === undefined || options.priority < 0 || options.priority > 65535) {
          errors.push('SRV record requires a valid priority (0-65535)');
        }
        if (options.weight === undefined || options.weight < 0 || options.weight > 65535) {
          errors.push('SRV record requires a valid weight (0-65535)');
        }
        // SRV format: priority weight port target
        const srvParts = options.value.split(' ');
        if (srvParts.length !== 4) {
          errors.push('SRV record must be in format: "priority weight port target"');
        }
        break;
    }

    // TTL validation
    if (options.ttl !== undefined && (options.ttl < 0 || options.ttl > 604800)) {
      errors.push('TTL must be between 0 and 604800 seconds');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
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
}
