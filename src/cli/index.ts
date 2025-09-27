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
  const { exitCode } = await $`ping -c 1 ${config.ip}`.nothrow();
  if (exitCode !== 0) {
    console.log("IP address is not reachable, checking security group");

    if (config.securityGroupId === undefined) {
      console.log("Security group ID not found, creating a new one");
      const securityGroupId = (await $`aws ec2 create-security-group --group-name cloud-router --description "Cloud Router Security Group" --vpc-id ${config.vpcId} --query 'GroupId' --output text`.text()).trim();
      config.securityGroupId = securityGroupId;
      setConfig(config);
    }

    const securityGroup = await $`aws ec2 describe-security-groups --group-ids ${config.securityGroupId} --region ${config.region} --query 'SecurityGroups[0]' --output json`.quiet().json();
    if (securityGroup.IpPermissions.length === 0) {
      console.log("Security group has no inbound rules, adding a new one");
      const userIp = await getUserIp();
      await $`aws ec2 authorize-security-group-ingress --group-id ${config.securityGroupId} --protocol tcp --port 22 --cidr ${userIp}/32`.quiet();
    } else {
      console.log("Security group has inbound rules, checking if user IP is in the rules");
      const userIp = await getUserIp();
      const inRules = securityGroup.IpPermissions.some((rule: any) => rule.IpRanges.some((range: any) => range.CidrIp === `${userIp}/32`));
      if (!inRules) {
        console.log("User IP is not in the rules, adding a new one");
        await $`aws ec2 authorize-security-group-ingress --group-id ${config.securityGroupId} --protocol tcp --port 22 --cidr ${userIp}/32`.quiet();
      } else {
        console.log("User IP is in the rules, no need to add a new one");
      }
    }
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

      // Launch the instance in the specified VPC and subnet
      const instance = await $`aws ec2 run-instances --image-id ${config.ami} --instance-type ${config.class} --key-name ${config.key} --region ${region} --subnet-id ${config.subnetId} --associate-public-ip-address`.json();
      console.log(instance);
      config.instanceId = instance.Instances[0].InstanceId;
      setConfig(config);

      console.log(`Instance ID: ${config.instanceId} started...`);

      const userIp = await getUserIp();
      console.log(`User IP: ${userIp}`);

      const securityGroupId = (await $`aws ec2 create-security-group --group-name cloud-router --description "Cloud Router Security Group" --vpc-id ${config.vpcId} --query 'GroupId' --output text`.text()).trim();
      await $`aws ec2 authorize-security-group-ingress --group-id ${securityGroupId} --protocol tcp --port 22 --cidr ${userIp}/32`;
      config.securityGroupId = securityGroupId;
      setConfig(config);

      console.log(`Security Group ID: ${securityGroupId} created`);

      let up = false;
      while (!up) {
        const instance = await $`aws ec2 describe-instances --instance-ids ${config.instanceId} --region ${region}`.json();
        console.log(instance);
        if (instance.Instances[0].State.Name === "running") {
          up = true;
        }
        await Bun.sleep(1000);
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