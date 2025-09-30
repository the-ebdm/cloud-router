import {
  Route53Client,
  ListHostedZonesCommand,
  GetHostedZoneCommand,
  CreateHostedZoneCommand,
  DeleteHostedZoneCommand,
  ListResourceRecordSetsCommand,
  ChangeResourceRecordSetsCommand,
  ChangeResourceRecordSetsCommandInput,
  HostedZone,
  ResourceRecordSet,
  Change,
  RRType,
  ChangeAction,
} from '@aws-sdk/client-route-53';

export interface Route53Config {
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
}

export interface DNSRecordData {
  name: string;
  type: RRType;
  value: string;
  ttl: number;
  priority?: number;
  weight?: number;
}

export interface HostedZoneSummary {
  id: string;
  name: string;
  recordCount: number;
  createdAt?: Date;
}

export class Route53ClientService {
  private client: Route53Client;

  constructor(config: Route53Config = {}) {
    this.client = new Route53Client({
      region: config.region || process.env.AWS_REGION || 'us-east-1',
      credentials: config.accessKeyId && config.secretAccessKey ? {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
        sessionToken: config.sessionToken,
      } : undefined,
    });
  }

  /**
   * List all hosted zones
   */
  async listHostedZones(): Promise<HostedZoneSummary[]> {
    try {
      const command = new ListHostedZonesCommand({});
      const response = await this.client.send(command);

      return (response.HostedZones || []).map(zone => ({
        id: zone.Id!.replace('/hostedzone/', ''), // Remove /hostedzone/ prefix
        name: zone.Name!,
        recordCount: zone.ResourceRecordSetCount || 0,
        createdAt: zone.Created ? new Date(zone.Created) : undefined,
      }));
    } catch (error) {
      throw new Error(`Failed to list hosted zones: ${error}`);
    }
  }

  /**
   * Get detailed hosted zone information
   */
  async getHostedZone(hostedZoneId: string): Promise<HostedZone> {
    try {
      const command = new GetHostedZoneCommand({
        Id: hostedZoneId,
      });
      const response = await this.client.send(command);

      if (!response.HostedZone) {
        throw new Error(`Hosted zone ${hostedZoneId} not found`);
      }

      return response.HostedZone;
    } catch (error) {
      throw new Error(`Failed to get hosted zone ${hostedZoneId}: ${error}`);
    }
  }

  /**
   * Find hosted zone by domain name
   */
  async findHostedZoneByName(domainName: string): Promise<HostedZoneSummary | null> {
    try {
      const zones = await this.listHostedZones();

      // Look for exact match first
      let exactMatch = zones.find(zone => zone.name === domainName);
      if (exactMatch) return exactMatch;

      // Look for zones that are parents of the domain
      const domainParts = domainName.split('.');
      for (let i = 1; i < domainParts.length - 1; i++) {
        const potentialZone = domainParts.slice(i).join('.') + '.';
        const match = zones.find(zone => zone.name === potentialZone);
        if (match) return match;
      }

      return null;
    } catch (error) {
      throw new Error(`Failed to find hosted zone for ${domainName}: ${error}`);
    }
  }

  /**
   * Create a new hosted zone
   */
  async createHostedZone(domainName: string, comment?: string): Promise<{ hostedZoneId: string; nameServers: string[] }> {
    try {
      const command = new CreateHostedZoneCommand({
        Name: domainName,
        CallerReference: `${domainName}-${Date.now()}`, // Unique reference
        HostedZoneConfig: {
          Comment: comment || `Hosted zone for ${domainName}`,
        },
      });

      const response = await this.client.send(command);

      if (!response.HostedZone?.Id || !response.DelegationSet?.NameServers) {
        throw new Error('Invalid response from Route53');
      }

      return {
        hostedZoneId: response.HostedZone.Id.replace('/hostedzone/', ''),
        nameServers: response.DelegationSet.NameServers,
      };
    } catch (error) {
      throw new Error(`Failed to create hosted zone for ${domainName}: ${error}`);
    }
  }

  /**
   * Delete a hosted zone
   */
  async deleteHostedZone(hostedZoneId: string): Promise<void> {
    try {
      const command = new DeleteHostedZoneCommand({
        Id: hostedZoneId,
      });
      await this.client.send(command);
    } catch (error) {
      throw new Error(`Failed to delete hosted zone ${hostedZoneId}: ${error}`);
    }
  }

  /**
   * List DNS records for a hosted zone
   */
  async listDNSRecords(hostedZoneId: string): Promise<DNSRecordData[]> {
    try {
      const command = new ListResourceRecordSetsCommand({
        HostedZoneId: hostedZoneId,
      });

      const response = await this.client.send(command);
      const records: DNSRecordData[] = [];

      for (const record of response.ResourceRecordSets || []) {
        if (record.Type === 'SOA' || record.Type === 'NS') {
          // Skip SOA and NS records as they're managed by AWS
          continue;
        }

        records.push({
          name: record.Name!,
          type: record.Type!,
          value: record.ResourceRecords?.[0]?.Value || '',
          ttl: record.TTL || 300,
          priority: record.SetIdentifier ? undefined : record.Priority, // Only for weighted routing
          weight: record.SetIdentifier ? record.Weight : undefined,
        });
      }

      return records;
    } catch (error) {
      throw new Error(`Failed to list DNS records for hosted zone ${hostedZoneId}: ${error}`);
    }
  }

  /**
   * Create or update DNS records
   */
  async upsertDNSRecords(hostedZoneId: string, records: DNSRecordData[]): Promise<void> {
    try {
      const changes: Change[] = records.map(record => ({
        Action: ChangeAction.UPSERT,
        ResourceRecordSet: {
          Name: record.name,
          Type: record.type,
          TTL: record.ttl,
          ResourceRecords: [{
            Value: record.value,
          }],
          ...(record.priority !== undefined && { Priority: record.priority }),
          ...(record.weight !== undefined && { Weight: record.weight }),
        },
      }));

      const command = new ChangeResourceRecordSetsCommand({
        HostedZoneId: hostedZoneId,
        ChangeBatch: {
          Changes: changes,
        },
      });

      await this.client.send(command);
    } catch (error) {
      throw new Error(`Failed to upsert DNS records in hosted zone ${hostedZoneId}: ${error}`);
    }
  }

  /**
   * Delete DNS records
   */
  async deleteDNSRecords(hostedZoneId: string, records: DNSRecordData[]): Promise<void> {
    try {
      const changes: Change[] = records.map(record => ({
        Action: ChangeAction.DELETE,
        ResourceRecordSet: {
          Name: record.name,
          Type: record.type,
          TTL: record.ttl,
          ResourceRecords: [{
            Value: record.value,
          }],
          ...(record.priority !== undefined && { Priority: record.priority }),
          ...(record.weight !== undefined && { Weight: record.weight }),
        },
      }));

      const command = new ChangeResourceRecordSetsCommand({
        HostedZoneId: hostedZoneId,
        ChangeBatch: {
          Changes: changes,
        },
      });

      await this.client.send(command);
    } catch (error) {
      throw new Error(`Failed to delete DNS records from hosted zone ${hostedZoneId}: ${error}`);
    }
  }

  /**
   * Check if hosted zone exists
   */
  async hostedZoneExists(hostedZoneId: string): Promise<boolean> {
    try {
      await this.getHostedZone(hostedZoneId);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate AWS credentials and permissions
   */
  async validatePermissions(): Promise<{ valid: boolean; errors: string[] }> {
    try {
      // Try to list hosted zones to validate permissions
      await this.listHostedZones();
      return { valid: true, errors: [] };
    } catch (error: any) {
      const errors: string[] = [];

      if (error.name === 'CredentialsProviderError') {
        errors.push('AWS credentials not found or invalid');
      } else if (error.name === 'AccessDeniedException') {
        errors.push('Insufficient permissions to access Route53');
      } else {
        errors.push(`Route53 API error: ${error.message}`);
      }

      return { valid: false, errors };
    }
  }
}
