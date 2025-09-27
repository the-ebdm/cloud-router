import { program } from "commander";
import { $ } from "bun";
import path from "path";
import fs from "fs";

import { ssh, getConfig, setConfig, ensureSecurityGroup, ensureSshIngress, ensureSecurityGroupAttached, checkAWSCli, getRegion, describeInstance } from "./utils";

program.command("status").action(async () => {
  const config = getConfig();
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

  // Check configuration
  // Check if ip is set
  if (config.ip === undefined) {
    console.log("IP address not found, getting public IP...");
    const publicIp = await $`aws ec2 describe-instances --instance-ids ${config.instanceId} --region ${config.region} --query 'Reservations[0].Instances[0].PublicIpAddress' --output text`.text();
    config.ip = publicIp;
    setConfig(config);
  }

  console.log(`Checking configuration...`);

  // Ping the ip
  const { exitCode } = await ssh(config.ip, "echo 'Hello, World!'");
  if (exitCode !== 0) {
    console.log("IP address is not reachable, checking security group");

    // Ensure security group exists, has SSH ingress, and is attached to the instance
    const securityGroupId = await ensureSecurityGroup(config, config.region);
    await ensureSshIngress(securityGroupId, config.region);
    await ensureSecurityGroupAttached(config.instanceId, securityGroupId, config.region);
    console.log("Security group checked/updated; try connecting again.");
  }
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

      if (config.key === null) {
        console.log("No key found, generating a new one");
        const key = await $`aws ec2 create-key-pair --key-name ${id} --query 'KeyMaterial' --output text`.text();
        const keyFilePath = path.join(process.env.HOME!, ".cloud-router", "cloud-router.pem");
        fs.writeFileSync(keyFilePath, key);
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

program.parse(process.argv);