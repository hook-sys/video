"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { audit, requireAdmin } from "@/lib/admin";
import { generateImage, generateVoice } from "@/lib/ai/fal";
import { type AiConfig, SETTING_KEY, TEXT_TASKS, forgetAiConfig, normalizeConfig, textClient, textCost, unitCost } from "@/lib/ai/models";

// /admin/models: which AI model does each job. Super admins only; every save
// is written to the audit log. Keys are never read back or shown.

async function superAdmin() {
  const s = await requireAdmin();
  if (s.role !== "super_admin") throw new Error("Only a super admin can change AI models.");
  return s;
}

const text = (f: FormData, k: string, max = 200) => String(f.get(k) ?? "").trim().slice(0, max);
const num = (f: FormData, k: string) => {
  const v = text(f, k);
  return v === "" ? undefined : Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : undefined;
};
const validTemplate = (t: string) => {
  if (!t) return true;
  try {
    const v = JSON.parse(t);
    return !!v && typeof v === "object" && !Array.isArray(v);
  } catch {
    return false;
  }
};

export async function saveAiModels(formData: FormData) {
  const s = await superAdmin();
  const prices: AiConfig["prices"] = {};
  for (let i = 0; i < 40; i++) {
    const model = text(formData, `price_model_${i}`);
    if (!model) continue;
    prices[model] = { in: num(formData, `price_in_${i}`), out: num(formData, `price_out_${i}`), unit: num(formData, `price_unit_${i}`) };
  }
  const next = normalizeConfig({
    text: { provider: text(formData, "text_provider"), model: text(formData, "text_model"), backup: formData.get("text_backup") === "on" },
    tasks: Object.fromEntries(TEXT_TASKS.map((t) => [t.id, { on: formData.get(`task_${t.id}_on`) === "on", provider: text(formData, `task_${t.id}_provider`), model: text(formData, `task_${t.id}_model`) }])),
    voice: { on: formData.get("voice_on") === "on", model: text(formData, "voice_model"), template: text(formData, "voice_template", 2000), female: text(formData, "voice_female", 80), male: text(formData, "voice_male", 80) },
    image: { on: formData.get("image_on") === "on", model: text(formData, "image_model"), template: text(formData, "image_template", 2000) },
    prices,
  });
  if (!validTemplate(next.voice.template) || !validTemplate(next.image.template)) redirect("/admin/models?error=" + encodeURIComponent("An input template is not a valid JSON object."));
  const { data: before } = await s.db.from("app_settings").select("value").eq("key", SETTING_KEY).maybeSingle();
  if (JSON.stringify(before?.value ?? null) === JSON.stringify(next)) redirect("/admin/models?saved=0");
  const { error } = await s.db.from("app_settings").upsert({ key: SETTING_KEY, value: next, updated_at: new Date().toISOString(), updated_by: s.userId });
  if (error) redirect("/admin/models?error=" + encodeURIComponent(error.message));
  await audit(s, "ai_models.update", { type: "settings", id: SETTING_KEY }, { from: before?.value ?? null, to: next });
  forgetAiConfig();
  revalidatePath("/admin/models");
  redirect("/admin/models?saved=1");
}

export type TestResult = { ok: boolean; ms?: number; output?: string; audioUrl?: string; imageUrl?: string; tokens?: string; cost?: string; error?: string };

const Probe = z.object({ tagline: z.string(), words: z.array(z.string()) });
const usd = (v: number) => `$${v < 0.01 ? v.toFixed(5) : v.toFixed(4)}`;

// One small real call with the typed (unsaved) settings: what it returns,
// how long it took and what it cost.
export async function testAiModel(_prev: TestResult | null, formData: FormData): Promise<TestResult> {
  await superAdmin();
  const kind = text(formData, "kind");
  const model = text(formData, "model");
  const started = Date.now();
  const { getAiConfig } = await import("@/lib/ai/models");
  const config = await getAiConfig();
  try {
    if (kind === "text") {
      if (!model) return { ok: false, error: "Type a model name." };
      const provider = text(formData, "provider") === "openai" ? "openai" : "fal";
      const ai = textClient(provider, model, false, { timeout: 60_000 });
      const res = await ai.client.responses.parse({
        model,
        instructions: "You write short, concrete marketing copy for SaaS products.",
        input: "Product: Flowly, a project management tool for small agencies. Write one tagline (max 8 words) and the three most important words of it.",
        text: { format: zodTextFormat(Probe, "probe") },
        ...(ai.quick ? { reasoning: { effort: "low" as const } } : {}),
      });
      const u = res.usage as { input_tokens?: number; output_tokens?: number; cost?: number } | null;
      const inTok = u?.input_tokens ?? 0;
      const outTok = u?.output_tokens ?? 0;
      const priced = textCost(config, model, inTok, outTok, () => NaN);
      const cost = typeof u?.cost === "number" ? `${usd(u.cost)} (reported by fal)` : Number.isFinite(priced) ? `${usd(priced)} (from your prices)` : "add this model's prices below to see it";
      return { ok: !!res.output_parsed, ms: Date.now() - started, output: res.output_parsed ? JSON.stringify(res.output_parsed, null, 1) : `Not valid JSON for the schema: ${String(res.output_text ?? "").slice(0, 400)}`, tokens: `${inTok} in · ${outTok} out`, cost };
    }
    if (kind === "voice") {
      const sample = "This is a MotionBrief voice test. Your product, explained in thirty seconds.";
      const r = await generateVoice({ script: sample, language: "English", style: "Friendly", gender: text(formData, "gender") || "female" }, { on: true, model, template: text(formData, "template", 2000), female: text(formData, "female", 80), male: text(formData, "male", 80) });
      const priced = unitCost(config, r.model, sample.length, () => NaN);
      return { ok: true, ms: Date.now() - started, audioUrl: r.audioUrl, output: r.words ? `${r.words.length} word timestamps` : "no word timestamps (the video will use estimated timing)", cost: Number.isFinite(priced) ? `${usd(priced)} for ${sample.length} characters (from your prices)` : `${sample.length} characters — add a price per character below` };
    }
    if (kind === "image") {
      const r = await generateImage({ prompt: "Soft abstract gradient shapes and floating glass panels, a calm SaaS product launch backdrop", format: "16:9" }, { on: true, model, template: text(formData, "template", 2000) });
      const priced = unitCost(config, r.model, 1, () => NaN);
      return { ok: true, ms: Date.now() - started, imageUrl: r.imageUrl, cost: Number.isFinite(priced) ? `${usd(priced)} (from your prices)` : "add a price per image below" };
    }
    return { ok: false, error: "Unknown test." };
  } catch (e) {
    return { ok: false, ms: Date.now() - started, error: (e instanceof Error ? e.message : String(e)).slice(0, 500) };
  }
}
