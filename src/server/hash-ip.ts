import { createHmac } from "node:crypto";

/** Stable per-visitor key that cannot be reversed to an IP address without the secret. */
export function hashIp(ip: string, key: string): string {
  return createHmac("sha256", key).update(ip).digest("hex").slice(0, 32);
}
