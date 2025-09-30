import { Route53ClientService, DNSRecordData } from './route53-client';
import { DNSRecordModel, DNSRecord } from '../models/dns-record';
import { DomainModel } from '../models/domain';

export interface DNSRecordSyncResult {
  success: boolean;
  syncedCount: number;
  createdCount: number;
  updatedCount: number;
  deletedCount: number;
  errors: string[];
  duration: number;
}

export interface DNSRecordComparison {
  localOnly: DNSRecord[];
  remoteOnly: DNSRecordData[];
  matching: Array<{ local: DNSRecord; remote: DNSRecordData }>;
  conflicts: Array<{ local: DNSRecord; remote: DNSRecordData; reason: string }>;
}

export class DNSRecordRetrievalService {
  constructor(
    private route53Client: Route53ClientService,
    private dnsRecordModel: DNSRecordModel,
    private domainModel: DomainModel
  ) {}

  /**
   * Sync DNS records from Route53 to local database for a domain
   */
  async syncDNSRecords(domainId: number): Promise<DNSRecordSyncResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let syncedCount = 0;
    let createdCount = 0;
    let updatedCount = 0;
    let deletedCount = 0;

    try {
      // Get domain info
      const domain = this.domainModel.findById(domainId);
      if (!domain) {
        throw new Error(`Domain with ID ${domainId} not found`);
      }

      if (!domain.hosted_zone_id) {
        throw new Error(`Domain ${domain.name} has no hosted zone ID`);
      }

      // Get remote DNS records from Route53
      const remoteRecords = await this.route53Client.listDNSRecords(domain.hosted_zone_id);

      // Get local DNS records from database
      const localRecords = this.dnsRecordModel.findByDomainId(domainId);

      // Compare records
      const comparison = this.compareDNSRecords(localRecords, remoteRecords);

      // Handle conflicts (for now, prioritize remote records)
      for (const conflict of comparison.conflicts) {
        errors.push(`Conflict for ${conflict.local.name} (${conflict.local.type}): ${conflict.reason}`);
        // In a real implementation, you might want to handle conflicts differently
      }

      // Create new records from remote
      for (const remoteRecord of comparison.remoteOnly) {
        try {
          this.dnsRecordModel.create({
            domain_id: domainId,
            name: remoteRecord.name,
            type: remoteRecord.type as any,
            value: remoteRecord.value,
            ttl: remoteRecord.ttl,
            priority: remoteRecord.priority,
            weight: remoteRecord.weight,
            source: 'route53',
          });
          createdCount++;
          syncedCount++;
        } catch (error) {
          errors.push(`Failed to create record ${remoteRecord.name}: ${error}`);
        }
      }

      // Update matching records
      for (const match of comparison.matching) {
        try {
          const needsUpdate = this.recordsDiffer(match.local, match.remote);
          if (needsUpdate) {
            this.dnsRecordModel.update(match.local.id!, {
              value: match.remote.value,
              ttl: match.remote.ttl,
              priority: match.remote.priority,
              weight: match.remote.weight,
            });
            updatedCount++;
          }
          syncedCount++;
        } catch (error) {
          errors.push(`Failed to update record ${match.local.name}: ${error}`);
        }
      }

      // Delete local-only records (they were removed from Route53)
      for (const localRecord of comparison.localOnly) {
        try {
          this.dnsRecordModel.delete(localRecord.id!);
          deletedCount++;
        } catch (error) {
          errors.push(`Failed to delete record ${localRecord.name}: ${error}`);
        }
      }

      // Update domain's last synced timestamp and record count
      this.domainModel.updateLastSynced(domainId);
      this.domainModel.updateRecordCount(domainId);

      const duration = Date.now() - startTime;

      return {
        success: errors.length === 0,
        syncedCount,
        createdCount,
        updatedCount,
        deletedCount,
        errors,
        duration,
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        success: false,
        syncedCount: 0,
        createdCount: 0,
        updatedCount: 0,
        deletedCount: 0,
        errors: [`Sync failed: ${error}`],
        duration,
      };
    }
  }

  /**
   * Compare local and remote DNS records
   */
  private compareDNSRecords(localRecords: DNSRecord[], remoteRecords: DNSRecordData[]): DNSRecordComparison {
    const localOnly: DNSRecord[] = [];
    const remoteOnly: DNSRecordData[] = [];
    const matching: Array<{ local: DNSRecord; remote: DNSRecordData }> = [];
    const conflicts: Array<{ local: DNSRecord; remote: DNSRecordData; reason: string }> = [];

    // Create maps for efficient lookup
    const localMap = new Map<string, DNSRecord>();
    const remoteMap = new Map<string, DNSRecordData>();

    // Keys are in format: "name:type"
    localRecords.forEach(record => {
      const key = `${record.name}:${record.type}`;
      localMap.set(key, record);
    });

    remoteRecords.forEach(record => {
      const key = `${record.name}:${record.type}`;
      remoteMap.set(key, record);
    });

    // Find matches and local-only records
    for (const [key, localRecord] of localMap) {
      const remoteRecord = remoteMap.get(key);
      if (remoteRecord) {
        matching.push({ local: localRecord, remote: remoteRecord });
        remoteMap.delete(key); // Remove from remote map so remaining are remote-only
      } else {
        localOnly.push(localRecord);
      }
    }

    // Remaining remote records are remote-only
    remoteOnly.push(...remoteMap.values());

    return {
      localOnly,
      remoteOnly,
      matching,
      conflicts, // Empty for now - could be enhanced to detect actual conflicts
    };
  }

  /**
   * Check if local and remote records differ
   */
  private recordsDiffer(local: DNSRecord, remote: DNSRecordData): boolean {
    return (
      local.value !== remote.value ||
      local.ttl !== remote.ttl ||
      local.priority !== remote.priority ||
      local.weight !== remote.weight
    );
  }

  /**
   * Get DNS records for a domain (from local database)
   */
  getDNSRecords(domainId: number): DNSRecord[] {
    return this.dnsRecordModel.findByDomainId(domainId);
  }

  /**
   * Get DNS record by ID
   */
  getDNSRecordById(recordId: number): DNSRecord | undefined {
    return this.dnsRecordModel.findById(recordId);
  }

  /**
   * Get DNS records by type for a domain
   */
  getDNSRecordsByType(domainId: number, type: string): DNSRecord[] {
    const allRecords = this.dnsRecordModel.findByDomainId(domainId);
    return allRecords.filter(record => record.type === type);
  }

  /**
   * Search DNS records by name pattern
   */
  searchDNSRecords(domainId: number, namePattern: string): DNSRecord[] {
    const allRecords = this.dnsRecordModel.findByDomainId(domainId);
    const regex = new RegExp(namePattern, 'i');
    return allRecords.filter(record => regex.test(record.name));
  }

  /**
   * Get DNS record statistics for a domain
   */
  getDNSRecordStats(domainId: number): {
    total: number;
    byType: Record<string, number>;
    bySource: Record<string, number>;
  } {
    const records = this.dnsRecordModel.findByDomainId(domainId);

    const byType: Record<string, number> = {};
    const bySource: Record<string, number> = {};

    for (const record of records) {
      byType[record.type] = (byType[record.type] || 0) + 1;
      bySource[record.source] = (bySource[record.source] || 0) + 1;
    }

    return {
      total: records.length,
      byType,
      bySource,
    };
  }

  /**
   * Validate DNS record data from Route53
   */
  validateDNSRecordData(record: DNSRecordData): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!record.name) {
      errors.push('Record name is required');
    }

    if (!record.type || !['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'SRV', 'PTR'].includes(record.type)) {
      errors.push('Invalid or missing record type');
    }

    if (!record.value) {
      errors.push('Record value is required');
    }

    if (record.ttl < 0 || record.ttl > 604800) {
      errors.push('TTL must be between 0 and 604800 seconds');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
