import { program } from "commander";
import path from "path";
import fs from "fs";
import { $ } from "bun";
import os from "os";

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

export const getIdentity = async () => {
  const identity = await $`aws sts get-caller-identity --output json`.json();
  return identity;
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

export type SSHOptions = {
  timeout?: number
  showOutput?: boolean
  verbose?: boolean
  cwd?: string
}

export const ssh = async (ip: string, command: string, options: SSHOptions = {}) => {
  const { timeout = 10000, showOutput = false, verbose = false, cwd = '/home/ec2-user/cloud-router' } = options;
  const config = getConfig();
  const targetIp = config.tailscaleHostname || ip;  // Prefer Tailscale if available
  if (showOutput) {
    if (verbose) {
      console.log(`SSHing to ${targetIp} (using ${config.tailscaleHostname ? 'Tailscale' : 'public'} IP)`);
      return await $`ssh -vvv -o ConnectTimeout=${timeout / 1000} -i ~/.cloud-router/cloud-router.pem ec2-user@${targetIp} ${command}`.nothrow();
    }
    return await $`ssh -o ConnectTimeout=${timeout / 1000} -i ~/.cloud-router/cloud-router.pem ec2-user@${targetIp} ${command}`.nothrow();
  }
  return await $`ssh -o ConnectTimeout=${timeout / 1000} -i ~/.cloud-router/cloud-router.pem ec2-user@${targetIp} ${command}`.quiet().nothrow();
};

// Create a long-lived SSH master connection using OpenSSH ControlMaster multiplexing
export const createSSHSession = async (config: any, options: { controlPersist?: number, timeout?: number, workDir?: string } = {}) => {
  const { controlPersist = 600, timeout = 10_000, workDir = '/home/ec2-user/cloud-router' } = options;
  const targetIp = config.tailscaleHostname || config.ip;
  const keyFile = path.join(process.env.HOME!, ".cloud-router", "cloud-router.pem");

  // Ensure control socket path
  const socketName = `cm-${String(targetIp).replace(/[^a-zA-Z0-9]/g, "-")}.sock`;
  const socketPath = path.join(process.env.HOME!, ".cloud-router", socketName);

  // Start master connection (background, no command)
  const masterArgs = `-o ControlMaster=yes -o ControlPath=${socketPath} -o ControlPersist=${controlPersist}`;
  const startRes = await $`ssh ${masterArgs} -o ConnectTimeout=${Math.ceil(timeout / 1000)} -i ${keyFile} -fN ec2-user@${targetIp}`.nothrow();

  // Capture login shell environment once so we can reuse PATH and other important vars
  let envExports = "";
  try {
    const envRes = await $`ssh -S ${socketPath} -o ConnectTimeout=${Math.ceil(timeout / 1000)} -i ${keyFile} ec2-user@${targetIp} bash --login -c 'env -0'`.quiet().nothrow();
    const raw = envRes.stdout || envRes.text || "";
    if (raw) {
      const parts = raw.split('\0');
      const exports: string[] = [];
      for (const p of parts) {
        if (!p) continue;
        const eq = p.indexOf('=');
        if (eq === -1) continue;
        const key = p.slice(0, eq);
        const val = p.slice(eq + 1);
        // escape single quotes
        const safe = val.replace(/'/g, "'\\''");
        exports.push(`export ${key}='${safe}'`);
      }
      if (exports.length > 0) {
        envExports = exports.join(' && ') + ' && ';
      }
    }
  } catch (e) {
    // best-effort; if we can't fetch env, proceed without it
    envExports = '';
  }

  const run = async (command: string, opts: SSHOptions = {}) => {
    const { timeout: cmdTimeout = timeout, showOutput = false, verbose = false, cwd = workDir } = opts;
    // default to running inside the configured workDir so callers don't need to 'cd' repeatedly
    const fullCommand = `${command}`;
    console.log(`Running command: ${fullCommand}`);
    if (showOutput) {
      if (verbose) {
        return await $`ssh -S ${socketPath} -o ConnectTimeout=${Math.ceil(cmdTimeout / 1000)} -i ${keyFile} ec2-user@${targetIp} bash -lc cd ${cwd} && ${command}`.nothrow();
      }
      return await $`ssh -S ${socketPath} -o ConnectTimeout=${Math.ceil(cmdTimeout / 1000)} -i ${keyFile} ec2-user@${targetIp} bash -lc cd ${cwd} && ${command}`.nothrow();
    }
    return await $`ssh -S ${socketPath} -o ConnectTimeout=${Math.ceil(cmdTimeout / 1000)} -i ${keyFile} ec2-user@${targetIp} bash -lc cd ${cwd} && ${command}`.quiet().nothrow();
  };

  const close = async () => {
    try {
      await $`ssh -S ${socketPath} -O exit -i ${keyFile} ec2-user@${targetIp}`.nothrow();
    } catch (_) { }
    try { fs.unlinkSync(socketPath); } catch (_) { }
  };

  return { startRes, run, close, socketPath };
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

// Run connectivity diagnostics from the user's machine towards the target public IP
export const runConnectivityDiagnostics = async (publicIp: string) => {
  const diagnostics: any = {};

  try {
    // TCP port 22 check using nc if available
    const ncCheck = await $`nc -vz ${publicIp} 22`.nothrow();
    diagnostics.tcp22 = { exitCode: ncCheck.exitCode, text: ncCheck.stderr || ncCheck.stdout };
  } catch (e) {
    diagnostics.tcp22 = { error: String(e) };
  }

  try {
    // Traceroute to the host
    const tracer = await $`traceroute -m 30 ${publicIp}`.nothrow();
    diagnostics.traceroute = { exitCode: tracer.exitCode, text: tracer.stdout || tracer.stderr };
  } catch (e) {
    diagnostics.traceroute = { error: String(e) };
  }

  try {
    // Check network interfaces on AWS for the instance by resolving via public IP -> describe-network-interfaces
    // This is a lightweight probe that attempts to find ENIs matching the IP
    const eniLookup = await $`aws ec2 describe-network-interfaces --filters Name=addresses.association.public-ip,Values=${publicIp} --output json`.nothrow();
    diagnostics.eni = { exitCode: eniLookup.exitCode, json: eniLookup.stdout || eniLookup.stderr };
  } catch (e) {
    diagnostics.eni = { error: String(e) };
  }

  return diagnostics;
}

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
    await ssh(config.ip, command, {
      showOutput: true
    });
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
  const statusRes = await ssh(config.ip, 'tailscale status --json', {
    timeout: 10000
  });
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

export const ensureGit = async (config: any, runner?: (cmd: string, opts?: SSHOptions) => Promise<any>) => {
  const run = runner || ((c: string, o?: SSHOptions) => ssh(config.ip, c, { ...o, showOutput: false }));
  const gitRes = await run("git --version");
  if (gitRes.exitCode !== 0) {
    console.log("Git is not installed; installing...");
    await run("sudo yum install -y git");
  }
  console.log("Git installed successfully");
};

export const ensureBun = async (config: any, runner?: (cmd: string, opts?: SSHOptions) => Promise<any>) => {
  const run = runner || ((c: string, o?: SSHOptions) => ssh(config.ip, c, { ...o, showOutput: false }));
  const bunPath = "/home/ec2-user/.bun/bin/bun";
  const bunRes = await run(`${bunPath} --version`);
  if (bunRes.exitCode !== 0) {
    console.log("Bun is not installed; installing...");
    await run("curl -fsSL https://bun.sh/install | bash");
    console.log("Bun installed successfully");
  }
  return bunPath;
};

export const canPingCloudRouter = async (config: any) => {
  const pingRes = await $`ping -c 1 cloud-router`.quiet().nothrow();
  return pingRes.exitCode === 0;
}

// SCP/SSH helpers for CLI operations against the remote cloud-router
export const scpDownload = async (config: any, remotePath: string, localPath: string) => {
  const keyFile = path.join(process.env.HOME!, ".cloud-router", "cloud-router.pem");
  const cmd = $`scp -i ${keyFile} -o StrictHostKeyChecking=no ec2-user@${config.ip}:${remotePath} ${localPath}`.nothrow();
  return await cmd;
}

export const scpUpload = async (config: any, localPath: string, remotePath: string) => {
  const keyFile = path.join(process.env.HOME!, ".cloud-router", "cloud-router.pem");
  const cmd = $`scp -i ${keyFile} -o StrictHostKeyChecking=no ${localPath} ec2-user@${config.ip}:${remotePath}`.nothrow();
  return await cmd;
}

// Try to find the remote sqlite database path by probing common locations
export const findRemoteDatabasePath = async (config: any) => {
  const candidates = [
    '~/cloud-router/database.sqlite',
    '~/database.sqlite',
    '/home/ec2-user/cloud-router/database.sqlite',
    '~/cloud-router/database/database.sqlite',
    'database.sqlite'
  ];
  for (const p of candidates) {
    const testCmd = `test -f ${p} && echo exists || echo missing`;
    const res = await ssh(config.ip, testCmd, {
      timeout: 5000
    });
    if (res.exitCode === 0 && res.stdout && res.stdout.toString().includes('exists')) {
      return p.replace(/^~\//, '/home/ec2-user/');
    }
  }
  return null;
}

export const createSystemdService = async (config: any) => {
  const run = (cmd: string) => ssh(config.ip, cmd, { showOutput: false });

  const serviceContent = `[Unit]
Description=Cloud Router Server
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=ec2-user
Group=ec2-user
WorkingDirectory=/home/ec2-user/cloud-router
ExecStart=/home/ec2-user/cloud-router/dist/server
Restart=always
RestartSec=5
MemoryLimit=400M
CPUQuota=80%
StandardOutput=append:/home/ec2-user/cloud-router/logs/cloud-router.log
StandardError=append:/home/ec2-user/cloud-router/logs/cloud-router.log

[Install]
WantedBy=multi-user.target`;

  const expectedHash = require('crypto').createHash('sha256').update(serviceContent).digest('hex');

  // Check if file exists and get its hash
  const checkHashCmd = `test -f /etc/systemd/system/cloud-router.service && sha256sum /etc/systemd/system/cloud-router.service | cut -d' ' -f1 || echo missing`;
  const checkHashRes = await run(checkHashCmd);

  const currentHash = checkHashRes.stdout?.toString().trim();

  if (currentHash && currentHash !== 'missing' && currentHash === expectedHash) {
    return { exists: true, hashMatch: true };
  }

  // Create or update the service file
  const createCmd = `sudo tee /etc/systemd/system/cloud-router.service > /dev/null << 'EOF'
${serviceContent}
EOF
sudo systemctl daemon-reload`;

  const createRes = await run(createCmd);

  if (createRes.exitCode === 0) {
    if (currentHash && currentHash !== 'missing') {
      console.log("Systemd service updated (hash mismatch) and reloaded.");
    } else {
      console.log("Systemd service created and reloaded.");
    }
  } else {
    console.log("Failed to create/update systemd service.");
  }

  return { ...createRes, hashMatch: false };
};

export const enableSystemdService = async (config: any) => {
  const run = (cmd: string) => ssh(config.ip, cmd, { showOutput: true });
  const cmd = "sudo systemctl enable cloud-router";
  const res = await run(cmd);
  if (res.exitCode !== 0) {
    console.log("Failed to enable systemd service.");
  }
  return res;
};

export const startSystemdService = async (config: any) => {
  const run = (cmd: string) => ssh(config.ip, cmd, { showOutput: false });
  const cmd = "sudo systemctl start cloud-router";
  const res = await run(cmd);
  if (res.exitCode !== 0) {
    console.log("Failed to start systemd service.");
  }
  return res;
};

export const getSystemdStatus = async (config: any) => {
  const run = (cmd: string) => ssh(config.ip, cmd, { showOutput: false });
  const cmd = "sudo systemctl status cloud-router --no-pager -l";
  const res = await run(cmd);
  return res;
};