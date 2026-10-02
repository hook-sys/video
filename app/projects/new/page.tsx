import type { Metadata } from "next";
import Link from "next/link";
import { VERCEL_SCREENSHOT_TOTAL_BYTES } from "@/lib/projects";
import { heroPlan } from "@/components/landing/hero-plan";
import { Logo } from "@/components/brand/logo";
import { CreateProjectForm } from "./create-project-form";

export const metadata: Metadata = { title: "New video" };

// The generation pipeline runs after the response (after()) within this limit.
export const maxDuration = 300;

export default function NewProjectPage() {
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
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Create your video</h1>
          <p className="max-w-xl text-foreground/60">Six quick steps. MotionBrief directs the scenes, records the voice and renders your promo.</p>
        </div>
        <CreateProjectForm maxTotalBytes={process.env.VERCEL ? VERCEL_SCREENSHOT_TOTAL_BYTES : undefined} waiting={heroPlan()} />
      </main>
    </div>
  );
}
