import { $ } from "bun";

export const getTailscaleStatus = async () => {
  const status = await $`tailscale status --json`.json();
  return status;
};