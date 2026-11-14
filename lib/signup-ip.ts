import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

// One account from each network address (/admin/settings "One account per
// network"). The address is read from what our own front server says (Caddy
// on the VPS sets X-Real-IP to the address it was reached from; Vercel sets it
// too), never from what a browser could write itself. Only a keyed hash of it
// is kept (table signup_ips), so the addresses themselves are never stored.

export async function clientIp(): Promise<string | null> {
  const h = await headers();
  const real = h.get("x-real-ip")?.trim();
  if (real) return real;
  // (the last address is the one the nearest proxy added; the first could be anything)
  const list = h.get("x-forwarded-for")?.split(",").map((x) => x.trim()).filter(Boolean) ?? [];
  return list.at(-1) ?? null;
}

const hashOf = (ip: string) =>
  createHmac("sha256", process.env.IP_HASH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "motiondots")
    .update(ip.toLowerCase())
    .digest("hex");

// Has an account been made from this address? (no address known, or the table not there yet: no)
export async function ipTaken(ip: string | null): Promise<boolean> {
  if (!ip) return false;
  const { data, error } = await createAdminClient().from("signup_ips").select("user_id").eq("ip_hash", hashOf(ip)).maybeSingle();
  return !error && !!data;
}

// The address kept for the account just made (a second at the same moment meets the key and is refused).
export async function keepIp(ip: string | null, userId: string): Promise<boolean> {
  if (!ip) return true;
  const { error } = await createAdminClient().from("signup_ips").insert({ ip_hash: hashOf(ip), user_id: userId });
  // (23505: taken; 42P01: the table is not there yet — the account is kept, nothing is limited)
  return !error || error.code !== "23505";
}
