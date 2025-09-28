import { $ } from "bun";
import { logger } from "@/lib/logger";

// Look up a hosted zone ID for a domain using the AWS CLI. Returns the hosted zone ID string
// or null if not found. This uses JSON parsing to avoid brittle text processing and
// returns helpful errors if the aws cli is not available or permission is denied.
export const getHostedZoneId = async (domain: string): Promise<string | null> => {
  try {
    // Ensure domain is normalized to have a trailing dot like Route53 returns
    const normalized = domain.endsWith('.') ? domain : `${domain}.`;

    // Ask AWS CLI to return HostedZones as JSON. We avoid jq dependency and parse JSON here.
    const raw = await $`aws route53 list-hosted-zones --output json`;
    if (!raw || !raw.stdout) {
      logger.warn('AWS CLI returned no output when listing hosted zones');
      return null;
    }

    let parsed: any;
    try {
      parsed = JSON.parse(raw.stdout.toString());
    } catch (err: any) {
      logger.error('Failed to parse AWS CLI JSON output for hosted zones', { error: err.message });
      return null;
    }

    if (!Array.isArray(parsed.HostedZones)) {
      logger.warn('AWS CLI returned unexpected shape for hosted zones', { shape: Object.keys(parsed) });
      return null;
    }

    const zone = parsed.HostedZones.find((z: any) => z.Name === normalized);
    if (!zone) return null;
    // zone.Id looks like '/hostedzone/XXXXXXXXXXXXX'
    const parts = zone.Id.split('/');
    return parts.pop() || null;
  } catch (error: any) {
    // Common causes: aws not installed, credentials missing, permission denied
    logger.error('Error while looking up hosted zones via AWS CLI', { error: error.message });
    return null;
  }
};