import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { type PastLook, pastLookOf } from "@/lib/ai/motion-director";
import { type BrandProfile, type CreativePlan } from "@/lib/studio";
import { type StoredComposition } from "@/components/video/composer/variants";
import { type StyleT, styleOf } from "@/components/video/composer/style";
import { neverList } from "@/lib/video-rules";

// What the Motion Director is given besides the script, shared by both
// pipelines (app/projects/actions.ts and lib/v2/pipeline.ts).

// The Director's NEVER list: built-in rules plus the active `video_rules`
// rows (admin → Video rules). Never blocks a video.
export async function loadNeverList(admin: ReturnType<typeof createAdminClient>) {
  try {
    const { data } = await admin.from("video_rules").select("id, never").eq("active", true).limit(50);
    return neverList(data ?? []);
  } catch {
    return neverList();
  }
}


// What the Motion Director is given: the brand, the script, the website, and
// what this customer has had before (the next video is unlike those).
export type Past = { seen: { display: string[]; field: string[] }; seenStaging: (NonNullable<StoredComposition["staging"]> | null)[]; recent: { staging: NonNullable<StoredComposition["staging"]> | null; display: string | null }[]; avoidStyles?: (StyleT | null)[] };

export async function pastOf(admin: ReturnType<typeof createAdminClient>, projectId: string, userId: string, name: string) {
  const { data: past } = await admin.from("projects").select("brand_name, composer:brief->composer").eq("user_id", userId).neq("id", projectId).order("created_at", { ascending: false }).limit(20);
  const rows = (past ?? []).map((p) => ({ brand: (p.brand_name ?? "").trim().toLowerCase(), composer: p.composer as { profile?: BrandProfile; creative?: CreativePlan; videos?: StoredComposition[] } | null }));
  const same = rows.filter((p) => p.brand === name.toLowerCase());
  const known = same.map((p) => p.composer?.profile).find((x): x is BrandProfile => !!x?.category) ?? null;
  const earlier = same.flatMap((p) => (p.composer?.creative ? [{ idea: p.composer.creative.idea, language: p.composer.videos?.at(-1)?.staging?.language ?? p.composer.creative.language }] : [])).slice(0, 6);
  const pastVideos = rows.slice(0, 12).flatMap((p) => p.composer?.videos ?? []);
  const seenArts = pastVideos.map((v) => (v.script as { art?: { display?: string; field?: string } } | undefined)?.art ?? {});
  const seen = { display: [...new Set(seenArts.map((x) => x.display).filter((x): x is string => !!x))].slice(0, 12), field: [...new Set(seenArts.map((x) => x.field).filter((x): x is string => !!x))].slice(0, 6) };
  // how this customer's last videos were staged (the next is staged otherwise)
  const seenStaging = pastVideos.map((v) => v.staging ?? null).slice(0, 8).reverse();
  const recent = pastVideos.slice(0, 8).map((v) => ({ staging: v.staging ?? null, display: (v.script as { art?: { display?: string } } | undefined)?.art?.display ?? null }));
  // (for the Creative Director: how their last videos looked, any brand)
  const looks = rows.slice(0, 12).flatMap((p) => (p.composer?.videos ?? []).map((v) => pastLookOf(v, p.composer?.creative?.shape))).filter((x): x is PastLook => !!x).slice(0, 6);
  // the styles (composer/style.ts) of their last three videos: the next is unlike them
  const avoidStyles = pastVideos.slice(0, 3).map((v) => styleOf((v.script as { art?: Parameters<typeof styleOf>[0] } | undefined)?.art));
  return { known, earlier, looks, past: { seen, seenStaging, recent, avoidStyles } };
}

export const brandOf = (project: { brand_name?: string | null; brand_color?: string | null; call_to_action?: string | null; website_url?: string | null }, brief: { product_name?: string; cta?: string } | null) => {
  const host = (project.website_url ?? "").replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/.*$/, "");
  return { name: project.brand_name?.trim() || brief?.product_name || "Your product", color: project.brand_color || "#6a5bff", tagline: "", cta: project.call_to_action?.trim() || brief?.cta || "Get started", url: host, icon: null };
};
