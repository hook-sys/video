import "server-only";
import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

// A website address as the customer typed it, and whether a host is on the
// public internet (no private or internal networks). Kept apart from the
// browser that pictures the site, so the pages that only check a link never
// load it.

const blocked = new BlockList();
for (const [net, prefix] of [["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["224.0.0.0", 3]] as const) blocked.addSubnet(net, prefix, "ipv4");
for (const [net, prefix] of [["::", 127], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8]] as const) blocked.addSubnet(net, prefix, "ipv6");
function publicIp(ip: string) {
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)?.[1];
  if (mapped) return !blocked.check(mapped, "ipv4");
  const family = isIP(ip);
  return family !== 0 && !blocked.check(ip, family === 4 ? "ipv4" : "ipv6");
}
export async function isPublicHost(hostname: string): Promise<boolean> {
  const host = hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) return publicIp(host);
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) return false;
  try {
    const addresses = await lookup(host, { all: true });
    return addresses.length > 0 && addresses.every((a) => publicIp(a.address));
  } catch {
    return false;
  }
}

// a link as typed ("acme.com", "https://acme.com/") made a full https address, or null
export function websiteUrlOf(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim();
  if (!t || t.length > 300) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
    return (url.protocol === "https:" || url.protocol === "http:") && url.hostname.includes(".") ? url.toString() : null;
  } catch {
    return null;
  }
}
