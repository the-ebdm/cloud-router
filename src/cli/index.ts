import { program } from "commander";
import { $ } from "bun";
import path from "path";
import fs from "fs";

import { ssh, getConfig, setConfig, ensureSecurityGroup, ensureSshIngress, ensureSecurityGroupAttached, checkAWSCli, getRegion, describeInstance, describeSecurityGroup, getUserIp, ensureKeyPermissions, ensureTailscale, canPingCloudRouter, scpDownload, scpUpload, findRemoteDatabasePath, getIdentity, runConnectivityDiagnostics, ensureGit, ensureBun, createSSHSession } from "./utils";
import crypto from "crypto";
import { Database } from "bun:sqlite";
import os from "os";

program.command("status").action(async () => {
  let config = getConfig();
  const identity = await getIdentity();
  if (config.accountId !== identity.Account) {
    console.log("Account ID mismatch, please make sure you are logged in with the correct account");
    return;
  }
  if (config.instanceId === undefined) {
    setConfig({ ...config, status: "non-existent" });
    console.log("Run `cloud-router start` to start the router");
    return;
  }
  const instance = await $`aws ec2 describe-instances --instance-ids ${config.instanceId} --region ${config.region} --query 'Reservations[0].Instances[0]' --output json`.json();
  const status = instance.State.Name;
  if (status === "running") {
    setConfig({ ...config, status: "running" });
  } else {
    setConfig({ ...config, status: "stopped" });
  }
  if (status === "terminated") {
    setConfig({ ...config, status: "terminated" });
  }

  console.log(`Cloud Router is ${status}`);
  if (status !== "running") {
    return;
  }

  // Use direct SSH for initial source code check and setup (runs from remote home, no cd)
  const directSsh = (cmd: string, opts?: any) => ssh(config.ip, cmd, { ...opts, timeout: 10000, showOutput: true });

  const gitCheck = await directSsh("git -C /home/ec2-user/cloud-router rev-parse --git-dir");
  if (gitCheck.exitCode !== 0) {
    console.log("Valid git repository not found, setting up fresh...");
    await ensureGit(config);  // Installs git if needed, with showOutput via direct ssh
    const rmRes = await directSsh("rm -rf /home/ec2-user/cloud-router");
    if (rmRes.exitCode === 0) {
      console.log("Removed existing cloud-router directory.");
    }
    const cloneRes = await directSsh("git clone https://github.com/the-ebdm/cloud-router.git /home/ec2-user/cloud-router");
    if (cloneRes.exitCode !== 0) {
      console.log("Failed to clone source code. Check SSH connectivity, git installation, and try again.");
      return;
    }
    console.log("Cloned source code successfully.");
  } else {
    console.log("Source code found (valid git repo).");
  }

  // In the status command, after the gitCheck block and console.log("Source code found (valid git repo)."); or cloned successfully

  // Remove session creation and use direct SSH with cd for all subsequent commands
  const workDir = "/home/ec2-user/cloud-router";
  const cdRun = async (cmd: string, opts?: any) => {
    const fullCmd = `cd ${workDir} && ${cmd}`;
    return directSsh(fullCmd, { ...opts, showOutput: true });
  };

  // ls inside dir
  await cdRun("ls -la");

  // Ensure git (already done earlier, but ensureBun needs it implicitly)
  await ensureGit(config);  // Direct SSH

  console.log("Pulling source code...");
  const pullRes = await cdRun("git pull");
  if (pullRes.exitCode !== 0) {
    console.log("Git pull failed; repository may be up to date or have issues. Continuing...");
  }

  const bunPath = await ensureBun(config);  // Direct SSH, no runner needed now

  await cdRun(`${bunPath} install`);

  await cdRun(`${bunPath} run build`);

  // No session to close
});

program.command("start").action(async () => {
  const config = getConfig();
  if (config.status === "non-existent") {
    if (config.provider === "aws") {
      if (!(await checkAWSCli())) {
        console.log("AWS CLI is not installed");
        return;
      }

      const id = `cloud-router-${Date.now()}`
      const region = await getRegion();
      console.log(`Region: ${region}`);
      console.log(`Instance class: ${config.class}`);

      setConfig({ ...config, region });

      if (!config.key) {
        console.log("No key found, generating a new one");
        const key = await $`aws ec2 create-key-pair --key-name ${id} --query 'KeyMaterial' --output text`.text();
        const keyFilePath = path.join(process.env.HOME!, ".cloud-router", "cloud-router.pem");
        if (fs.existsSync(keyFilePath)) {
          // Move the old key to a backup file
          fs.renameSync(keyFilePath, path.join(process.env.HOME!, ".cloud-router", "cloud-router.pem.backup"));
        }
        fs.writeFileSync(keyFilePath, key);
        fs.chmodSync(keyFilePath, 0o400);  // Set secure permissions
        console.log("SSH key created with secure permissions (0400).");
        config.key = id;
        setConfig(config);
      }

      if (!config.vpcId) {
        console.log("No VPC ID found, creating a new one");

        // TODO: Ensure idempotency
        // Create VPC
        const vpcId = (await $`aws ec2 create-vpc --cidr-block 10.0.0.0/16 --query 'Vpc.VpcId' --output text`.text()).trim();
        config.vpcId = vpcId;
        setConfig(config);

        // Enable public DNS hostname for the VPC
        await $`aws ec2 modify-vpc-attribute --vpc-id ${vpcId} --enable-dns-support "{\"Value\":true}"`;
        await $`aws ec2 modify-vpc-attribute --vpc-id ${vpcId} --enable-dns-hostnames "{\"Value\":true}"`;

        // Create a public subnet
        const subnetId = (await $`aws ec2 create-subnet --vpc-id ${vpcId} --cidr-block 10.0.1.0/24 --query 'Subnet.SubnetId' --output text`.text()).trim();
        config.subnetId = subnetId;
        setConfig(config);

        // Create and attach an internet gateway
        const igwId = (await $`aws ec2 create-internet-gateway --query 'InternetGateway.InternetGatewayId' --output text`.text()).trim();
        await $`aws ec2 attach-internet-gateway --internet-gateway-id ${igwId} --vpc-id ${vpcId}`;

        // Create a route table and associate it with the subnet
        const routeTableId = (await $`aws ec2 create-route-table --vpc-id ${vpcId} --query 'RouteTable.RouteTableId' --output text`.text()).trim();
        await $`aws ec2 create-route --route-table-id ${routeTableId} --destination-cidr-block 0.0.0.0/0 --gateway-id ${igwId}`;
        await $`aws ec2 associate-route-table --subnet-id ${subnetId} --route-table-id ${routeTableId}`;

        // Make the subnet auto-assign public IPs
        await $`aws ec2 modify-subnet-attribute --subnet-id ${subnetId} --map-public-ip-on-launch`;

        console.log(`Created VPC (${vpcId}) with 1 public subnet (${subnetId})`);
      }

      // Ensure we have vpcId and subnetId before launching the instance
      if (!config.vpcId || !config.subnetId) {
        console.error("VPC ID or Subnet ID missing, cannot launch instance.");
        return;
      }

      if (config.instanceId !== undefined) {
        console.log(`Instance ID: ${config.instanceId} already exists, no need to start`);
        return;
      }

      // Ensure security group exists and has SSH ingress before launching
      const securityGroupId = await ensureSecurityGroup(config, region);
      await ensureSshIngress(securityGroupId, region);

      // Launch the instance in the specified VPC and subnet with the security group
      const instance = await $`aws ec2 run-instances --image-id ${config.ami} --instance-type ${config.class} --key-name ${config.key} --region ${region} --subnet-id ${config.subnetId} --associate-public-ip-address --security-group-ids ${securityGroupId}`.json();
      console.log(instance);
      config.instanceId = instance.Instances[0].InstanceId;
      setConfig(config);

      console.log(`Instance ID: ${config.instanceId} started...`);

      // Ensure the security group is attached to the instance
      await ensureSecurityGroupAttached(config.instanceId, securityGroupId, region);

      let up = false;
      while (!up) {
        const instanceDesc = await describeInstance(config.instanceId, region);
        console.log(instanceDesc);
        if (instanceDesc.State.Name === "running") {
          up = true;
        }
        await new Promise((r) => setTimeout(r, 1000));
      }

      console.log(`Instance is up, getting public IP...`);
      const publicIp = await $`aws ec2 describe-instances --instance-ids ${config.instanceId} --region ${region} --query 'Reservations[0].Instances[0].PublicIpAddress' --output text`.text();
      config.ip = publicIp;
      setConfig(config);

      console.log(`Public IP: ${config.ip}`);
    }
  }
});

program.command("destroy")
  .option("-a, --all", "Destroy all resources")
  .action(async (options) => {
    const config = getConfig();

    if (config.instanceId) {
      // Delete instance
      await $`aws ec2 terminate-instances --instance-ids ${config.instanceId}`.quiet();

      // Wait until the instance is deleted
      let hasTerminated = false;
      while (!hasTerminated) {
        const instance = await describeInstance(config.instanceId, config.region);
        if (instance.State.Name === "terminated") {
          hasTerminated = true;
        } else {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }

      // Update config
      config.instanceId = undefined;
      config.ip = undefined;
    }

    if (config.securityGroupId) {
      // Delete security group
      await $`aws ec2 delete-security-group --group-id ${config.securityGroupId}`.quiet();
      config.securityGroupId = undefined;
    }

    // If all is specified, delete the VPC, subnet and key
    if (options.all) {
      if (config.key) {
        await $`aws ec2 delete-key-pair --key-name ${config.key}`.quiet();
        config.key = undefined;
        setConfig(config);
      }
      if (config.subnetId) {
        await $`aws ec2 delete-subnet --subnet-id ${config.subnetId}`.quiet();
        config.subnetId = undefined;
        setConfig(config);
      }
      if (config.vpcId) {
        await $`aws ec2 delete-vpc --vpc-id ${config.vpcId}`.quiet();
        config.vpcId = undefined;
        setConfig(config);
      }
    }
  });

program.command("generate-key")
  .description("Generate a new API key on the remote cloud-router and print it")
  .action(async () => {
    const config = getConfig();
    if (!config.ip) {
      console.error('No cloud-router IP found in config. Run `cloud-router start` first.');
      process.exit(1);
    }

    // Ensure SSH key exists and permissions are correct
    if (!ensureKeyPermissions()) {
      console.error('SSH key permissions issue; fix and retry.');
      process.exit(1);
    }

    // Find remote DB
    const remoteDbPath = await findRemoteDatabasePath(config);
    if (!remoteDbPath) {
      console.error('Could not find remote database file on the server');
      process.exit(1);
    }

    // Create local temporary directory
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cloud-router-'));
    const localDbPath = path.join(tmpDir, 'database.sqlite');

    console.log(`Downloading remote DB ${remoteDbPath} to ${localDbPath}...`);
    const dl = await scpDownload(config, remoteDbPath, localDbPath);
    if (dl.exitCode !== 0) {
      console.error(`Failed to download DB: exitCode=${dl.exitCode}`);
      fs.rmSync(tmpDir, { recursive: true, force: true });
      process.exit(1);
    }

    try {
      // Open DB and insert API key
      const db = new Database(localDbPath);
      const key = crypto.randomBytes(32).toString('hex');
      const timestamp = new Date().toISOString();
      const stmt = db.prepare('INSERT INTO api_keys (key, created_at, updated_at) VALUES (?, ?, ?)');
      const result = stmt.run(key, timestamp, timestamp);
      const id = result.lastInsertRowid as number;
      // Close DB (Bun sqlite does not require explicit close but we'll free variable)
      // Upload modified DB back to remote
      console.log(`Uploading modified DB back to ${remoteDbPath}...`);
      const up = await scpUpload(config, localDbPath, remoteDbPath);
      if (up.exitCode !== 0) {
        console.error(`Failed to upload DB: exitCode=${up.exitCode}`);
        fs.rmSync(tmpDir, { recursive: true, force: true });
        process.exit(1);
      }

      console.log(`Generated API key (save this now — it will not be shown again): ${key}`);
      console.log(`API key id: ${id}`);
    } finally {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) { }
    }
  });

program
  .command("exec")
  .description("Execute a command on the remote cloud-router instance")
  .argument("<command>", "The command to execute on the remote instance")
  .option("-v, --verbose", "Show verbose SSH output")
  .action(async (cmd: string, options) => {
    const config = getConfig();
    if (config.status !== "reachable") {
      console.log("Cloud Router is not reachable. Run `cloud-router status` first to set it up.");
      return;
    }

    if (!config.ip) {
      console.error("No IP found in config.");
      process.exit(1);
    }

    const keyOk = ensureKeyPermissions();  // Note: ensureKeyPermissions is now exported and synchronous
    if (!keyOk) {
      console.error("SSH key issue; fix with: chmod 400 ~/.cloud-router/cloud-router.pem");
      process.exit(1);
    }

    // Use direct SSH with cd to work dir and the command
    const workDir = "/home/ec2-user/cloud-router";
    const fullCmd = `cd ${workDir} && ${cmd}`;

    const sshOpts: any = {
      showOutput: true,
      timeout: 30000,  // 30s default
    };
    if (options.verbose) {
      sshOpts.verbose = true;
    }

    console.log(`Running remote command: ${cmd}`);
    const result = await ssh(config.ip, fullCmd, sshOpts);

    if (result.exitCode !== 0) {
      console.log(`Command failed with exit code ${result.exitCode}`);
      if (result.stderr) {
        console.error(`Error output: ${result.stderr}`);
      }
    } else {
      console.log("Command completed successfully.");
    }
  });

program.parse(process.argv);