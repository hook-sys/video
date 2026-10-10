import { internalAllowed } from "@/lib/internal-key";
import { generateVoice } from "@/lib/ai/fal";

// Preview only, with the team's key (lib/internal-key.ts): one short sample
// of a voice name on the configured voice model (no fallback to another
// voice), returned as base64 — for the team to check a name exists and to
// keep a sample of it (public/voices).

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: Request) {
  if (!(await internalAllowed(request))) return new Response("Not found", { status: 404 });
  const url = new URL(request.url);
  const name = url.searchParams.get("name") ?? "";
  const gender = url.searchParams.get("gender") === "female" ? "female" : "male";
  if (!/^[A-Za-z]{2,20}$/.test(name)) return Response.json({ error: "name=<voice>" }, { status: 400 });
  const text = url.searchParams.get("text")?.slice(0, 200) || `Hi, I'm ${name}. I'll turn your product into a video people remember.`;
  try {
    const v = await generateVoice({ script: text, language: "English (US)", style: "Professional", gender, voice: name }, {});
    if (!v.audioUrl) return Response.json({ name, error: "no audio" });
    const audio = Buffer.from(await (await fetch(v.audioUrl)).arrayBuffer());
    const end = v.words?.at(-1)?.end ?? null;
    return Response.json({ name, model: v.model, seconds: end, bytes: audio.length, b64: audio.toString("base64") });
  } catch (e) {
    return Response.json({ name, error: e instanceof Error ? e.message.slice(0, 300) : String(e) });
  }
}
