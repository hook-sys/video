"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BRAND_KITS_MAX, PHONE_MAX, TAGLINE_MAX, brandKitOf, kitLogoPath } from "@/lib/brand-kits";
import { BRAND_NAME_MAX, SCREENSHOTS_BUCKET, SCREENSHOT_TYPES, isHexColor, validateLogo } from "@/lib/projects";
import { websiteUrlOf } from "@/lib/website-url";

// The customer's brand kits (/brand): add or change one (its icon uploaded
// once), make one the default, remove one. Written by the server only.

async function signedIn() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user;
}

const back = (msg: string, key = "error"): never => redirect(`/brand?${key}=${encodeURIComponent(msg)}`);

export async function saveBrandKit(formData: FormData) {
  const user = await signedIn();
  const admin = createAdminClient();
  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const colorRaw = String(formData.get("color") ?? "").trim();
  const websiteRaw = String(formData.get("website_url") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const tagline = String(formData.get("tagline") ?? "").normalize("NFC").trim();
  const logoEntry = formData.get("logo");
  const logo = logoEntry instanceof File && logoEntry.size > 0 ? logoEntry : null;

  if (!name) back("Your company name is required.");
  if (name.length > BRAND_NAME_MAX) back(`Company name must be ${BRAND_NAME_MAX} characters or less.`);
  if (colorRaw && !isHexColor(colorRaw)) back("Brand colour must be a hex colour like #0E9CA6.");
  const website = websiteRaw ? websiteUrlOf(websiteRaw) : null;
  if (websiteRaw && !website) back("The website must be an address like yourcompany.com.");
  if (phone.length > PHONE_MAX) back(`The phone number must be ${PHONE_MAX} characters or less.`);
  if (tagline.length > TAGLINE_MAX) back(`The tagline must be ${TAGLINE_MAX} characters or less.`);
  if (logo) {
    const problem = validateLogo(logo);
    if (problem) back(problem);
  }

  const fields = { name, color: colorRaw ? colorRaw.toUpperCase() : null, website_url: website, phone: phone || null, tagline: tagline || null, updated_at: new Date().toISOString() };
  let kitId = id;
  let oldLogo: string | null = null;
  if (id) {
    const kit = await brandKitOf(admin, user.id, id);
    if (!kit) back("That brand kit was not found.");
    oldLogo = kit!.logoPath;
    const { error } = await admin.from("brand_kits").update(fields).eq("id", id).eq("user_id", user.id);
    if (error) back("The brand kit could not be saved. Please try again.");
  } else {
    if (!logo) back("Upload your icon.");
    const { count } = await admin.from("brand_kits").select("id", { count: "exact", head: true }).eq("user_id", user.id);
    if ((count ?? 0) >= BRAND_KITS_MAX) back(`You can keep up to ${BRAND_KITS_MAX} brand kits. Remove one to add another.`);
    const { data, error } = await admin
      .from("brand_kits")
      .insert({ ...fields, user_id: user.id, is_default: (count ?? 0) === 0 })
      .select("id")
      .single();
    if (error || !data) back("The brand kit could not be saved. Please try again.");
    kitId = data!.id;
  }

  if (logo) {
    const at = kitLogoPath(user.id, kitId, SCREENSHOT_TYPES[logo.type]);
    const up = await admin.storage.from(SCREENSHOTS_BUCKET).upload(at, logo, { contentType: logo.type, upsert: true });
    if (up.error) {
      if (!id) await admin.from("brand_kits").delete().eq("id", kitId).eq("user_id", user.id);
      back("Icon upload failed. Please try again.");
    }
    await admin.from("brand_kits").update({ logo_path: at }).eq("id", kitId).eq("user_id", user.id);
    if (oldLogo && oldLogo !== at) await admin.storage.from(SCREENSHOTS_BUCKET).remove([oldLogo]).catch(() => {});
  }
  revalidatePath("/brand");
  back(id ? "Brand kit saved." : "Brand kit added. Pick it when you make a video.", "ok");
}

export async function setDefaultBrandKit(formData: FormData) {
  const user = await signedIn();
  const admin = createAdminClient();
  const kit = await brandKitOf(admin, user.id, String(formData.get("id") ?? ""));
  if (!kit) back("That brand kit was not found.");
  await admin.from("brand_kits").update({ is_default: false }).eq("user_id", user.id).eq("is_default", true);
  await admin.from("brand_kits").update({ is_default: true }).eq("id", kit!.id).eq("user_id", user.id);
  revalidatePath("/brand");
  back(`${kit!.name} is now your default brand.`, "ok");
}

export async function deleteBrandKit(formData: FormData) {
  const user = await signedIn();
  const admin = createAdminClient();
  const kit = await brandKitOf(admin, user.id, String(formData.get("id") ?? ""));
  if (!kit) back("That brand kit was not found.");
  await admin.from("brand_kits").delete().eq("id", kit!.id).eq("user_id", user.id);
  if (kit!.logoPath) await admin.storage.from(SCREENSHOTS_BUCKET).remove([kit!.logoPath]).catch(() => {});
  revalidatePath("/brand");
  back("Brand kit removed.", "ok");
}
