import { $ } from "bun";

export const getHostedZoneId = async (domain: string) => {
  const zones = await $`aws route53 list-hosted-zones --query 'HostedZones[]' | jq -r '.[] | { Name, Id }'`
  const zone = zones.find((zone: any) => `${zone.Name}.` === domain);
  return zone.Id.split('/').pop();
};