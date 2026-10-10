import { internalAllowed } from "@/lib/internal-key";
import { after } from "next/server";
import { checkProjectFrames } from "@/lib/frame-check";
import { renderWithin } from "@/lib/render-server";

// Preview only, with the team's key (lib/internal-key.ts): starts the
// server render (or, with &check=1, the frame check) of one project, for the
// team to measure it. Answers at once; the work runs after the response and
// its outcome is stored on the project.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!(await internalAllowed(request))) return new Response("Not found", { status: 404 });
  const url = new URL(request.url);
  const id = url.searchParams.get("project") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "project=<id>" }, { status: 400 });
  const check = url.searchParams.get("check") === "1";
  after(async () => {
    const result = check ? await checkProjectFrames(id, 285_000) : await renderWithin(id, 285_000);
    console.info("render-test:", id, check ? "check" : "render", JSON.stringify(result)?.slice(0, 500));
  });
  return Response.json({ started: check ? "frame check" : "render", project: id });
}
