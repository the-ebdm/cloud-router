import { Route53ClientService } from './route53-client';
import { DomainModel } from '../models/domain';
import { Database } from 'bun:sqlite';

export interface HostedZoneCreationOptions {
  domainName: string;
  comment?: string;
  createIfNotExists?: boolean;
  skipValidation?: boolean;
}

export interface HostedZoneCreationResult {
  success: boolean;
  hostedZoneId?: string;
  nameServers?: string[];
  domainId?: number;
  error?: string;
  warnings: string[];
}

export class HostedZoneCreationService {
  constructor(
    private route53Client: Route53ClientService,
    private domainModel: DomainModel
  ) { }

  /**
   * Create a hosted zone for a domain
   * This will create both the Route53 hosted zone and update the domain record
   */
  async createHostedZone(options: HostedZoneCreationOptions): Promise<HostedZoneCreationResult> {
    const { domainName, comment, createIfNotExists = true, skipValidation = false } = options;
    const warnings: string[] = [];

    try {
      // Validate domain name format if not skipping validation
      if (!skipValidation) {
        const validation = this.validateDomainName(domainName);
        if (!validation.valid) {
          return {
            success: false,
            error: validation.error,
            warnings: [],
          };
        }
      }

      // Check if domain already exists in our system
      const existingDomain = this.domainModel.findByName(domainName);
      if (existingDomain) {
        if (existingDomain.hosted_zone_id) {
          return {
            success: false,
            error: `Domain ${domainName} already has a hosted zone (${existingDomain.hosted_zone_id})`,
            warnings: [],
          };
        }
        // Domain exists but no hosted zone - we'll update it
      }

      // Create the hosted zone in Route53
      const route53Result = await this.route53Client.createHostedZone(
        domainName,
        comment || `Cloud Router hosted zone for ${domainName}`
      );

      // Create or update domain record
      let domainId: number;
      if (existingDomain) {
        // Update existing domain
        const updateSuccess = this.domainModel.setHostedZoneId(
          existingDomain.id!,
          route53Result.hostedZoneId,
          new Date().toISOString()
        );
        if (!updateSuccess) {
          warnings.push('Failed to update domain record with hosted zone ID');
        }
        domainId = existingDomain.id!;
      } else {
        // Create new domain record
        domainId = this.domainModel.create({
          name: domainName,
          hosted_zone_id: route53Result.hostedZoneId,
          delegation_status: 'pending',
        });
      }

      return {
        success: true,
        hostedZoneId: route53Result.hostedZoneId,
        nameServers: route53Result.nameServers,
        domainId,
        warnings,
      };

    } catch (error) {
      return {
        success: false,
        error: `Failed to create hosted zone: ${error}`,
        warnings,
      };
    }
  }

  /**
   * Create hosted zones for multiple domains in batch
   */
  async createHostedZonesBatch(
    domains: HostedZoneCreationOptions[]
  ): Promise<Map<string, HostedZoneCreationResult>> {
    const results = new Map<string, HostedZoneCreationResult>();

    // Process domains sequentially to avoid rate limits
    for (const options of domains) {
      try {
        const result = await this.createHostedZone(options);
        results.set(options.domainName, result);

        // Small delay between creations to be respectful to AWS API
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        results.set(options.domainName, {
          success: false,
          error: `Unexpected error: ${error}`,
          warnings: [],
        });
      }
    }

    return results;
  }

  /**
   * Validate domain name for hosted zone creation
   */
  private validateDomainName(domainName: string): { valid: boolean; error?: string } {
    if (!domainName || domainName.trim().length === 0) {
      return { valid: false, error: 'Domain name is required' };
    }

    // Remove trailing dot if present for validation
    const cleanDomain = domainName.replace(/\.$/, '');

    // Basic domain validation regex
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/;

    if (!domainRegex.test(cleanDomain)) {
      return { valid: false, error: 'Invalid domain name format' };
    }

    // Check length constraints
    if (cleanDomain.length > 253) {
      return { valid: false, error: 'Domain name is too long (max 253 characters)' };
    }

    // Check for reserved TLDs or invalid patterns
    const parts = cleanDomain.split('.');
    if (parts.length < 2) {
      return { valid: false, error: 'Domain must have at least one subdomain' };
    }

    return { valid: true };
  }

  /**
   * Estimate Route53 costs for hosted zone creation
   */
  estimateCosts(domainCount: number): {
    monthlyCost: number;
    firstYearCost: number;
    breakdown: string[];
  } {
    // AWS Route53 pricing (as of 2024):
    // - $0.50 per hosted zone per month
    // - First 25 hosted zones free for first 12 months for new AWS customers

    const costPerZonePerMonth = 0.50;
    const monthlyCost = domainCount * costPerZonePerMonth;
    const firstYearCost = Math.max(0, monthlyCost * 12 - (25 * costPerZonePerMonth * 12)); // Assuming new customer discount

    const breakdown = [
      `${domainCount} hosted zones × $0.50/month = $${monthlyCost.toFixed(2)}/month`,
      `First year cost (with free tier): $${firstYearCost.toFixed(2)}`,
      'Note: First 25 hosted zones free for first 12 months for new customers',
    ];

    return {
      monthlyCost,
      firstYearCost,
      breakdown,
    };
  }

  /**
   * Clean up hosted zone (for testing or error recovery)
   */
  async cleanupHostedZone(hostedZoneId: string, domainName?: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.route53Client.deleteHostedZone(hostedZoneId);

      // Update domain record if provided
      if (domainName) {
        const domain = this.domainModel.findByName(domainName);
        if (domain) {
          this.domainModel.update(domain.id!, { hosted_zone_id: null as any });
          this.domainModel.setDelegationStatus(domain.id!, 'failed');
        }
      }

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: `Failed to cleanup hosted zone: ${error}`,
      };
    }
  }

  /**
   * Get creation status for a domain
   */
  getCreationStatus(domainName: string): {
    exists: boolean;
    hasHostedZone: boolean;
    delegationStatus: string;
    hostedZoneId?: string;
    nameServers?: string[];
  } {
    const domain = this.domainModel.findByName(domainName);

    if (!domain) {
      return {
        exists: false,
        hasHostedZone: false,
        delegationStatus: 'unknown',
      };
    }

    return {
      exists: true,
      hasHostedZone: !!domain.hosted_zone_id,
      delegationStatus: domain.delegation_status,
      hostedZoneId: domain.hosted_zone_id || undefined,
    };
  }
}
