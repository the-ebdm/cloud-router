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
  let parsedKeys: any = {};
  for (const key in config) {
    parsedKeys[key] = config[key]?.trim();
  }
  fs.writeFileSync(getConfigFile(), JSON.stringify(parsedKeys, null, 2));
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
  const config = getConfig();
  const targetIp = config.tailscaleIp || ip;  // Prefer Tailscale if available
  console.log(`SSHing to ${targetIp} (using ${config.tailscaleIp ? 'Tailscale' : 'public'} IP)`);
  return await $`ssh -o ConnectTimeout=${timeout / 1000} -i ~/.cloud-router/cloud-router.pem ec2-user@${targetIp} ${command}`.nothrow();
};

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
  // Return an object with before/after attachment state and the modify command result
  const instanceSgs = await $`aws ec2 describe-instances --instance-ids ${instanceId} --region ${region} --query 'Reservations[0].Instances[0].SecurityGroups' --output json`.json();
  const before = instanceSgs.map((g: any) => g.GroupId);
  const alreadyAttached = before.includes(groupId);
  if (alreadyAttached) {
    return { attached: true, before, after: before };
  }

  // Preserve existing groups and add the desired one
  const groupsToSet = Array.from(new Set([...before, groupId]));
  try {
    const modifyRes = await $`aws ec2 modify-instance-attribute --instance-id ${instanceId} --groups ${groupsToSet.join(" ")} --region ${region}`.nothrow();
    const instanceSgsAfter = await $`aws ec2 describe-instances --instance-ids ${instanceId} --region ${region} --query 'Reservations[0].Instances[0].SecurityGroups' --output json`.json();
    const after = instanceSgsAfter.map((g: any) => g.GroupId);
    return { attached: after.includes(groupId), before, after, modifyResult: modifyRes };
  } catch (err) {
    return { attached: false, before, after: before, modifyError: err };
  }
}

// Helper: ensure SSH key file has correct permissions (0600 or 0400)
export const ensureKeyPermissions = () => {
  const keyFilePath = path.join(process.env.HOME!, ".cloud-router", "cloud-router.pem");
  if (!fs.existsSync(keyFilePath)) {
    console.log("SSH key file not found; ensure 'start' has been run.");
    return false;
  }
  const stats = fs.statSync(keyFilePath);
  const mode = stats.mode & 0o777;
  if (mode !== 0o600 && mode !== 0o400) {
    console.log(`Fixing SSH key permissions (was ${mode.toString(8)}, setting to 0400)`);
    fs.chmodSync(keyFilePath, 0o400);
    return true;
  }
  return true;
};

export const checkTailscaleCli = async (config: any) => {
  const tailscaleCli = await ssh(config.ip, "tailscale --version");
  return tailscaleCli.exitCode === 0;
}

export const getTailscaleStatus = async (config: any) => {
  return await ssh(config.ip, "tailscale status --json");
}

export const ensureTailscale = async (config: any) => {
  if (!(await checkTailscaleCli(config))) {
    console.log("Tailscale CLI is not installed; installing...");
    const command = `curl -fsSL https://tailscale.com/install.sh | sh`
    await ssh(config.ip, command);
    console.log("Tailscale CLI installed successfully");
  }

  const status = await getTailscaleStatus(config);
  if (status.Online) {
    console.log("Tailscale is already running");
    return;
  }

  console.log("Tailscale is not running, starting it");
  await ssh(config.ip, `sudo tailscale up --auth-key=${config.tailscaleAuthKey} --hostname=cloud-router`);

  const status2 = await getTailscaleStatus(config);
  if (status2.Online) {
    console.log("Tailscale started successfully");
  } else {
    console.log("Tailscale failed to start");
  }

  // Get Tailscale status via SSH to public IP (fallback if needed)
  const statusRes = await ssh(config.ip, 'tailscale status --json', 10000);
  if (statusRes.exitCode === 0) {
    try {
      const tsStatus = JSON.parse(statusRes.text);
      if (tsStatus.Self && tsStatus.Self.TailscaleIPs && tsStatus.Self.TailscaleIPs.length > 0) {
        config.tailscaleIp = tsStatus.Self.TailscaleIPs[0];  // First IPv4
        setConfig(config);
        console.log(`Tailscale IP assigned: ${config.tailscaleIp}`);
      } else {
        console.log('Tailscale running but no IP assigned; run "sudo tailscale up" manually and auth.');
      }
    } catch (e) {
      console.log(`Failed to parse Tailscale status: ${e}`);
    }
  } else {
    console.log('Failed to query Tailscale status; ensure it\'s running.');
  }
};

export const canPingCloudRouter = async (config: any) => {
  const pingRes = await $`ping -c 1 cloud-router`.quiet().nothrow();
  return pingRes.exitCode === 0;
}