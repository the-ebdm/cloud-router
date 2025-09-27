import { getTailscaleStatus } from "@/lib/utils";

const status = await getTailscaleStatus();
console.log(status);