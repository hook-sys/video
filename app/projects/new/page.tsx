import type { Metadata } from "next";
import { VOICE_SCRIPT_MAX, voiceChoiceOf } from "@/lib/projects";
import { AppShell } from "@/components/site/app-shell";
import { userAccess } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { getAiConfig } from "@/lib/ai/models";
import { TIER_IDS, balanceOf, getBilling, grantSignupCredits, hasPaid } from "@/lib/billing";
import { CreateProjectForm, type Level, type Prefill } from "./create-project-form";

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
  const access = user ? await userAccess(supabase, user.id) : null;
  const admin = access?.admin ?? false;
  let prefill: Prefill | undefined;
  if (from && /^[0-9a-f-]{36}$/i.test(from)) {
    const { data } = await supabase.from("projects").select("direction, brand_name, website_url, call_to_action").eq("id", from).maybeSingle();
    if (data?.direction) prefill = { script: data.direction.replace(/\n\nVisual style:[\s\S]*$/, ""), brandName: data.brand_name ?? "", websiteUrl: data.website_url ?? "", cta: data.call_to_action ?? "", voice: voiceChoiceOf(data.direction) ?? "" };
  }
  // The voices customers can pick (set on /admin/models; none = by gender only).
  const { voice } = await getAiConfig();
  const voices = voice.on ? voice.choices : [];
  // the quality levels (no model names reach the browser) and the balance (the team: none)
  const billing = await getBilling();
  const paid = admin || (user ? await hasPaid(user.id) : false);
  const levels: Level[] = TIER_IDS.filter((id) => billing.tiers[id].status !== "off").map((id) => {
    const t = billing.tiers[id];
    return { id, name: t.name, blurb: t.blurb, badge: t.badge, perSecond: t.perSecond, soon: t.status === "soon", locked: t.paidOnly && !paid };
  });
  if (user) await grantSignupCredits(user.id, !!user.email_confirmed_at).catch(() => {});
  const credits = user && !admin ? await balanceOf(user.id) : null;
  return (
    <AppShell title="New video" admin={admin} active="new" initial={(user?.email ?? "?")[0]} wide action={<span />}>
      <div className="mb-6 flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{prefill ? "A new video of the same script" : "Create your video"}</h1>
        <p className="max-w-xl text-foreground/60">{prefill ? "Your script and brand are filled in. Change anything, add your icon, and create." : "Your words, your brand, your answers. MotionBrief records the voice and directs every scene."}</p>
      </div>
      {access?.pending && (
        <p className="mb-6 rounded-2xl border border-amber-500/25 bg-amber-50/70 px-4 py-3 text-sm text-amber-900">Your account is waiting for approval. You can look around and fill in your video now — your welcome credits arrive as soon as it&apos;s approved.</p>
      )}
      {/* (only welcome credits so far: a script short enough for them) */}
      <CreateProjectForm prefill={prefill} voices={voices} levels={levels} minSeconds={billing.minSeconds} credits={credits} scriptMax={paid ? VOICE_SCRIPT_MAX : billing.trialScriptMax} />
    </AppShell>
  );
}
