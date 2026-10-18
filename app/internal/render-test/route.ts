import { internalAllowed } from "@/lib/internal-key";
import { after } from "next/server";
import { renderWithin } from "@/lib/render-server";

// Preview only, with the team's key (lib/internal-key.ts): starts the
// server render of one project, for the team to measure it. Answers at
// once; the work runs after the response and its outcome is stored on the
// project.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!(await internalAllowed(request))) return new Response("Not found", { status: 404 });
  const id = new URL(request.url).searchParams.get("project") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "project=<id>" }, { status: 400 });
  after(async () => {
    const result = await renderWithin(id, 285_000);
    console.info("render-test:", id, JSON.stringify(result)?.slice(0, 500));
  });
  return Response.json({ started: "render", project: id });
}
