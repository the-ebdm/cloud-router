import { Route53ClientService, HostedZoneSummary } from './route53-client';

export interface DiscoveryResult {
  found: boolean;
  hostedZone?: HostedZoneSummary;
  candidates: HostedZoneSummary[];
  recommendedAction: 'use_existing' | 'create_new' | 'manual_review';
}

export class HostedZoneDiscoveryService {
  constructor(private route53Client: Route53ClientService) { }

  /**
   * Discover hosted zone for a domain
   * Attempts to find an existing hosted zone that matches the domain
   */
  async discoverHostedZone(domainName: string): Promise<DiscoveryResult> {
    try {
      // Ensure domain name ends with dot
      const normalizedDomain = domainName.endsWith('.') ? domainName : `${domainName}.`;

      // Get all hosted zones
      const allZones = await this.route53Client.listHostedZones();

      // Find exact matches
      const exactMatches = allZones.filter(zone =>
        zone.name.toLowerCase() === normalizedDomain.toLowerCase()
      );

      if (exactMatches.length === 1) {
        return {
          found: true,
          hostedZone: exactMatches[0],
          candidates: exactMatches,
          recommendedAction: 'use_existing',
        };
      }

      // Find parent zones (for subdomains)
      const parentZones = this.findParentZones(normalizedDomain, allZones);

      if (parentZones.length === 1) {
        return {
          found: true,
          hostedZone: parentZones[0],
          candidates: parentZones,
          recommendedAction: 'use_existing',
        };
      }

      // Multiple candidates found - need manual review
      if (exactMatches.length > 1 || parentZones.length > 1) {
        return {
          found: false,
          candidates: [...exactMatches, ...parentZones],
          recommendedAction: 'manual_review',
        };
      }

      // No hosted zone found
      return {
        found: false,
        candidates: [],
        recommendedAction: 'create_new',
      };

    } catch (error) {
      throw new Error(`Failed to discover hosted zone for ${domainName}: ${error}`);
    }
  }

  /**
   * Find parent hosted zones for a domain
   * For example, for "api.example.com" it will look for "example.com"
   */
  private findParentZones(domainName: string, allZones: HostedZoneSummary[]): HostedZoneSummary[] {
    const domainParts = domainName.split('.').filter(part => part.length > 0);

    // Try different levels of parent domains
    for (let i = 1; i < domainParts.length - 1; i++) {
      const potentialParent = domainParts.slice(i).join('.') + '.';
      const matches = allZones.filter(zone =>
        zone.name.toLowerCase() === potentialParent.toLowerCase()
      );

      if (matches.length > 0) {
        return matches;
      }
    }

    return [];
  }

  /**
   * Validate if a hosted zone is suitable for a domain
   */
  async validateHostedZoneForDomain(hostedZoneId: string, domainName: string): Promise<{
    valid: boolean;
    reason?: string;
    warnings: string[];
  }> {
    try {
      const hostedZone = await this.route53Client.getHostedZone(hostedZoneId);
      const warnings: string[] = [];

      // Check if domain is within hosted zone
      const zoneName = hostedZone.Name || '';
      const normalizedDomain = domainName.endsWith('.') ? domainName : `${domainName}.`;

      if (!normalizedDomain.endsWith(zoneName)) {
        return {
          valid: false,
          reason: `Domain ${domainName} is not within hosted zone ${zoneName}`,
          warnings: [],
        };
      }

      // Check if hosted zone is private (warning)
      if (hostedZone.Config?.PrivateZone) {
        warnings.push('Hosted zone is private - ensure domain delegation is configured correctly');
      }

      // Check record count (just informational)
      const recordCount = hostedZone.ResourceRecordSetCount || 0;
      if (recordCount > 1000) {
        warnings.push(`Hosted zone has ${recordCount} records - large zones may impact performance`);
      }

      return {
        valid: true,
        warnings,
      };

    } catch (error) {
      return {
        valid: false,
        reason: `Failed to validate hosted zone: ${error}`,
        warnings: [],
      };
    }
  }

  /**
   * Get hosted zone suggestions for domain creation
   * Returns recommendations for where to create hosted zones
   */
  getHostedZoneSuggestions(domainName: string): {
    apexZone: string;
    subdomainZones: string[];
    recommendation: string;
  } {
    const domainParts = domainName.split('.').filter(part => part.length > 0);

    // Apex zone (root domain)
    const apexZone = domainParts.join('.') + '.';

    // Potential subdomain zones
    const subdomainZones: string[] = [];
    for (let i = 0; i < domainParts.length - 2; i++) {
      const subdomainZone = domainParts.slice(i).join('.') + '.';
      subdomainZones.push(subdomainZone);
    }

    let recommendation = `Create hosted zone for apex domain: ${apexZone}`;

    if (domainParts.length > 2) {
      recommendation += `. For subdomains, consider creating separate zones like ${subdomainZones[0]} if you need different DNS configurations.`;
    }

    return {
      apexZone,
      subdomainZones,
      recommendation,
    };
  }

  /**
   * Batch discovery for multiple domains
   */
  async batchDiscoverHostedZones(domainNames: string[]): Promise<Map<string, DiscoveryResult>> {
    const results = new Map<string, DiscoveryResult>();

    // Get all hosted zones once for efficiency
    const allZones = await this.route53Client.listHostedZones();

    for (const domainName of domainNames) {
      try {
        // Use cached zones for discovery
        const normalizedDomain = domainName.endsWith('.') ? domainName : `${domainName}.`;

        // Find exact matches
        const exactMatches = allZones.filter(zone =>
          zone.name.toLowerCase() === normalizedDomain.toLowerCase()
        );

        if (exactMatches.length === 1) {
          results.set(domainName, {
            found: true,
            hostedZone: exactMatches[0],
            candidates: exactMatches,
            recommendedAction: 'use_existing',
          });
          continue;
        }

        // Find parent zones
        const parentZones = this.findParentZones(normalizedDomain, allZones);

        if (parentZones.length === 1) {
          results.set(domainName, {
            found: true,
            hostedZone: parentZones[0],
            candidates: parentZones,
            recommendedAction: 'use_existing',
          });
          continue;
        }

        // Multiple or no matches
        const candidates = [...exactMatches, ...parentZones];
        results.set(domainName, {
          found: false,
          candidates,
          recommendedAction: candidates.length > 1 ? 'manual_review' : 'create_new',
        });

      } catch (error) {
        // On error, assume create new
        results.set(domainName, {
          found: false,
          candidates: [],
          recommendedAction: 'create_new',
        });
      }
    }

    return results;
  }
}
