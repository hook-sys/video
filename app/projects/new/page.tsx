import type { Metadata } from "next";
import Link from "next/link";
import { VERCEL_SCREENSHOT_TOTAL_BYTES } from "@/lib/projects";
import { heroPlan } from "@/components/landing/hero-plan";
import { Logo } from "@/components/brand/logo";
import { createClient } from "@/lib/supabase/server";
import { CreateProjectForm, type Prefill } from "./create-project-form";

export const metadata: Metadata = { title: "New video" };

// The generation pipeline runs after the response (after()) within this limit.
export const maxDuration = 300;

// ?from=<project id>: the same script and brand as that project (one of the
// customer's own; RLS returns nothing otherwise), for a new video of it.
export default async function NewProjectPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams;
  let prefill: Prefill | undefined;
  if (from && /^[0-9a-f-]{36}$/i.test(from)) {
    const supabase = await createClient();
    const { data } = await supabase.from("projects").select("direction, brand_name, website_url, call_to_action").eq("id", from).maybeSingle();
    if (data?.direction) prefill = { script: data.direction.replace(/\n\nVisual style:[\s\S]*$/, ""), brandName: data.brand_name ?? "", websiteUrl: data.website_url ?? "", cta: data.call_to_action ?? "" };
  }
  return (
    <div className="flex min-h-full flex-1 flex-col bg-background">
      <header className="sticky top-0 z-20 border-b border-foreground/[0.07] bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Link href="/dashboard" aria-label="MotionBrief home">
            <Logo size={28} className="text-lg" />
          </Link>
          <Link href="/dashboard" className="ml-auto rounded-lg px-3 py-1.5 text-sm text-foreground/60 transition hover:bg-foreground/[0.05] hover:text-foreground">
            ← Dashboard
          </Link>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-violet-600 dark:text-violet-300">New video</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{prefill ? "A new video of the same script" : "Create your video"}</h1>
          <p className="max-w-xl text-foreground/60">{prefill ? "Your script and brand are filled in — change anything, add your icon, and create." : "Five quick steps. MotionBrief directs the scenes, records the voice and renders your promo."}</p>
        </div>
        <CreateProjectForm maxTotalBytes={process.env.VERCEL ? VERCEL_SCREENSHOT_TOTAL_BYTES : undefined} waiting={heroPlan()} prefill={prefill} />
      </main>
    </div>
  );
}
