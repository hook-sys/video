import { VERCEL_SCREENSHOT_TOTAL_BYTES } from "@/lib/projects";
import { CreateProjectForm } from "./create-project-form";

// The generation pipeline runs after the response (after()) within this limit.
export const maxDuration = 300;

export default function NewProjectPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12">
      <h1 className="text-2xl font-semibold">Create Video</h1>
      <CreateProjectForm
        maxTotalBytes={process.env.VERCEL ? VERCEL_SCREENSHOT_TOTAL_BYTES : undefined}
      />
    </main>
  );
}
