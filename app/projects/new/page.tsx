import { VERCEL_SCREENSHOT_TOTAL_BYTES } from "@/lib/projects";
import { CreateProjectForm } from "./create-project-form";

// The generation pipeline runs after the response (after()) within this limit.
export const maxDuration = 300;

export default function NewProjectPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-10 sm:py-16">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Create your video</h1>
        <p className="text-foreground/60">Write your script, pick a few options, and we&apos;ll do the rest.</p>
      </div>
      <CreateProjectForm maxTotalBytes={process.env.VERCEL ? VERCEL_SCREENSHOT_TOTAL_BYTES : undefined} />
    </main>
  );
}
