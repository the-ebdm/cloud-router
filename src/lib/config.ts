const config = {
  appPort: process.env.APP_PORT || 3000,
  apiPort: process.env.API_PORT || 3001,
  routerPort: process.env.ROUTER_PORT || 3002,
  tailscaleAuthKey: process.env.TAILSCALE_AUTH_KEY || "",
  tailscaleNetwork: process.env.TAILSCALE_NETWORK || "",
  tailscaleHostname: process.env.TAILSCALE_HOSTNAME || "",
  tailscaleDns: process.env.TAILSCALE_DNS || "",
  tailscaleDnsSuffix: process.env.TAILSCALE_DNS_SUFFIX || "",
};

export default config;