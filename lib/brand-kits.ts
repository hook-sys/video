import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SCREENSHOTS_BUCKET } from "@/lib/projects";

// Saved brand kits (supabase/migrations/20261112000036_brand_kits.sql): the
// customer's brand kept once on /brand and picked for each new video.

export const BRAND_KITS_MAX = 10;
export const TAGLINE_MAX = 120;
export const PHONE_MAX = 30;

export type BrandKit = {
  id: string;
  name: string;
  color: string | null;
  logoPath: string | null;
  logoUrl: string | null;
  websiteUrl: string | null;
  phone: string | null;
  tagline: string | null;
  isDefault: boolean;
};

export const kitLogoPath = (userId: string, kitId: string, ext: string) => `${userId}/brand-kits/${kitId}.${ext}`;

type Row = { id: string; name: string; color: string | null; logo_path: string | null; website_url: string | null; phone: string | null; tagline: string | null; is_default: boolean };
const COLUMNS = "id, name, color, logo_path, website_url, phone, tagline, is_default";

// The customer's kits, the default first, each icon with a signed URL for an hour.
// `admin`: the service-role client (the bucket is private; the paths are the user's own).
export async function listBrandKits(admin: SupabaseClient, userId: string): Promise<BrandKit[]> {
  const { data } = await admin.from("brand_kits").select(COLUMNS).eq("user_id", userId).order("is_default", { ascending: false }).order("created_at", { ascending: true });
  const rows = (data ?? []) as Row[];
  const paths = rows.flatMap((r) => (r.logo_path ? [r.logo_path] : []));
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data: signed } = await admin.storage.from(SCREENSHOTS_BUCKET).createSignedUrls(paths, 3600);
    for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  }
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    color: r.color,
    logoPath: r.logo_path,
    logoUrl: r.logo_path ? (urls.get(r.logo_path) ?? null) : null,
    websiteUrl: r.website_url,
    phone: r.phone,
    tagline: r.tagline,
    isDefault: r.is_default,
  }));
}

// One kit of the customer's, or null
export async function brandKitOf(admin: SupabaseClient, userId: string, kitId: string): Promise<Omit<BrandKit, "logoUrl"> | null> {
  if (!/^[0-9a-f-]{36}$/i.test(kitId)) return null;
  const { data } = await admin.from("brand_kits").select(COLUMNS).eq("user_id", userId).eq("id", kitId).maybeSingle();
  const r = data as Row | null;
  return r ? { id: r.id, name: r.name, color: r.color, logoPath: r.logo_path, websiteUrl: r.website_url, phone: r.phone, tagline: r.tagline, isDefault: r.is_default } : null;
}
