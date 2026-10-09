import type { Metadata } from "next";
import { VERCEL_SCREENSHOT_TOTAL_BYTES, voiceChoiceOf } from "@/lib/projects";
import { AppShell } from "@/components/site/app-shell";
import { userAccess } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { getAiConfig } from "@/lib/ai/models";
import { CreateProjectForm, type Prefill } from "./create-project-form";

export const metadata: Metadata = { title: "New video" };

// The generation pipeline runs after the response (after()) within this limit.
export const maxDuration = 300;

// ?from=<project id>: the same script and brand as that project (one of the
// customer's own; RLS returns nothing otherwise), for a new video of it.
export default async function NewProjectPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const admin = user ? (await userAccess(supabase, user.id)).admin : false;
  let prefill: Prefill | undefined;
  if (from && /^[0-9a-f-]{36}$/i.test(from)) {
    const { data } = await supabase.from("projects").select("direction, brand_name, website_url, call_to_action").eq("id", from).maybeSingle();
    if (data?.direction) prefill = { script: data.direction.replace(/\n\nVisual style:[\s\S]*$/, ""), brandName: data.brand_name ?? "", websiteUrl: data.website_url ?? "", cta: data.call_to_action ?? "", voice: voiceChoiceOf(data.direction) ?? "" };
  }
  // The voices customers can pick (set on /admin/models; none = by gender only).
  const { voice } = await getAiConfig();
  const voices = voice.on ? voice.choices : [];
  return (
    <AppShell title="New video" admin={admin} active="new" initial={(user?.email ?? "?")[0]} wide action={<span />}>
      <div className="mb-6 flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{prefill ? "A new video of the same script" : "Create your video"}</h1>
        <p className="max-w-xl text-foreground/60">{prefill ? "Your script and brand are filled in. Change anything, add your icon, and create." : "Five short steps. MotionBrief records the voice and directs every scene."}</p>
      </div>
      <CreateProjectForm maxTotalBytes={process.env.VERCEL ? VERCEL_SCREENSHOT_TOTAL_BYTES : undefined} prefill={prefill} voices={voices} />
    </AppShell>
  );
}
