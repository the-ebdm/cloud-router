import { program } from "commander";
import path from "path";
import fs from "fs";
import { $ } from "bun";

export const defaultConfig = {
  provider: "aws",
  class: "t4g.nano",
  ami: "ami-0ff5faf97e908a506",
  status: "non-existent",
  ip: null,
  key: null
}

export const getConfigFile = () => {
  const configFile = path.join(process.env.HOME!, ".cloud-router", "config.json");
  return configFile;
};

export const configFileExists = () => {
  const configFile = getConfigFile();
  return fs.existsSync(configFile);
};

export const getConfig = () => {
  try {
    const configFile = getConfigFile();
    return JSON.parse(fs.readFileSync(configFile, "utf8"));
  } catch (error) {
    const config = defaultConfig;
    fs.mkdirSync(path.join(process.env.HOME!, ".cloud-router"), { recursive: true });
    fs.writeFileSync(getConfigFile(), JSON.stringify(config, null, 2));
    return config;
  }
};

export const setConfig = (config: any) => {
  fs.writeFileSync(getConfigFile(), JSON.stringify(config, null, 2));
};

export const checkAWSCli = async () => {
  const awsCli = await $`aws --version`.text();
  return awsCli.includes("aws-cli");
}

export const getRegion = async () => {
  const res = await fetch("https://ifconfig.co/country-iso")
  const country = await res.text();
  switch (country.trim()) {
    case "GB":
      return "eu-west-2";
    case "US":
      return "us-east-1";
    default:
      return "eu-west-2";
  }
}

export const getUserIp = async () => {
  const res = await fetch("https://ifconfig.co/ip")
  const ip = await res.text();
  return ip.trim();
}

export const ssh = async (ip: string, command: string, timeout: number = 10000) => {
  return await $`ssh -o ConnectTimeout=${timeout / 1000} -i ~/.cloud-router/cloud-router.pem ec2-user@${ip} ${command}`.nothrow();
}

// Helper: describe an instance
export const describeInstance = async (instanceId: string, region: string) => {
  return await $`aws ec2 describe-instances --instance-ids ${instanceId} --region ${region} --query 'Reservations[0].Instances[0]' --output json`.json();
}

// Helper: describe a security group
export const describeSecurityGroup = async (groupId: string, region: string) => {
  return await $`aws ec2 describe-security-groups --group-ids ${groupId} --region ${region} --query 'SecurityGroups[0]' --output json`.quiet().json();
}

// Helper: ensure a security group exists (idempotent). Returns groupId.
export const ensureSecurityGroup = async (config: any, region: string) => {
  if (config.securityGroupId) {
    return config.securityGroupId;
  }

  const groupId = (await $`aws ec2 create-security-group --group-name cloud-router --description "Cloud Router Security Group" --vpc-id ${config.vpcId} --query 'GroupId' --output text`.text()).trim();
  config.securityGroupId = groupId;
  setConfig(config);
  return groupId;
}

// Helper: ensure SSH ingress for the user's IP is present on the security group
export const ensureSshIngress = async (groupId: string, region: string) => {
  const sg = await describeSecurityGroup(groupId, region);
  const userIp = await getUserIp();
  const desiredCidr = `${userIp}/32`;

  const hasRule = sg.IpPermissions.some((rule: any) =>
    rule.IpProtocol === "tcp" && rule.FromPort === 22 && rule.ToPort === 22 && rule.IpRanges.some((r: any) => r.CidrIp === desiredCidr)
  );

  if (!hasRule) {
    await $`aws ec2 authorize-security-group-ingress --group-id ${groupId} --protocol tcp --port 22 --cidr ${desiredCidr}`.quiet();
  }
}

// Helper: attach security group to instance if not already attached
export const ensureSecurityGroupAttached = async (instanceId: string, groupId: string, region: string) => {
  const instance = await $`aws ec2 describe-instances --instance-ids ${instanceId} --region ${region} --query 'Reservations[0].Instances[0].SecurityGroups' --output json`.json();
  const attached = instance.some((g: any) => g.GroupId === groupId);
  if (!attached) {
    // Replace instance groups with the desired one (note: this will remove other groups)
    await $`aws ec2 modify-instance-attribute --instance-id ${instanceId} --groups ${groupId} --region ${region}`.quiet();
  }
}