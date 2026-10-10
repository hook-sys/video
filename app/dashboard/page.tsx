import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { balanceOf, grantSignupCredits } from "@/lib/billing";
import { userAccess } from "@/lib/admin";
import { VIDEOS_BUCKET } from "@/lib/projects";
import { DashboardView } from "./view";

export const metadata: Metadata = { title: "Dashboard" };

export type DashboardRow = {
  id: string;
  created_at: string;
  brand_name: string | null;
  brand_color: string | null;
  website_url: string | null;
  duration_seconds: number | null;
  format: string | null;
  pipeline_status: string | null;
  pipeline_step: string | null;
  render_status: string | null;
  video_path: string | null;
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS: only this user's projects and profile.
  const [{ admin }, { data: rows }, { data: profile }] = await Promise.all([
    userAccess(supabase, user.id),
    supabase
      .from("projects")
      .select("id, created_at, brand_name, brand_color, website_url, duration_seconds, format, pipeline_status, pipeline_step, render_status, video_path")
      .order("created_at", { ascending: false })
      .limit(60),
    supabase.from("profiles").select("full_name, credits").eq("id", user.id).maybeSingle(),
    // (the welcome credits, once the email is confirmed)
    grantSignupCredits(user.id, !!user.email_confirmed_at).catch(() => {}),
  ]);
  const projects = (rows ?? []) as DashboardRow[];

  const credits = await balanceOf(user.id).catch(() => profile?.credits ?? 0);

  const name = profile?.full_name?.split(" ")[0] || user.email?.split("@")[0] || "there";
  const ready = projects.filter((p) => p.render_status === "completed" && p.video_path);
  const signed = ready.length
    ? (await supabase.storage.from(VIDEOS_BUCKET).createSignedUrls(ready.map((p) => p.video_path!), 3600)).data ?? []
    : [];
  const previews = Object.fromEntries(signed.filter((s) => s.signedUrl && s.path).map((s) => [s.path!, s.signedUrl as string]));

  return <DashboardView email={user.email ?? ""} name={name} admin={admin} credits={credits} projects={projects} previews={previews} />;
}
