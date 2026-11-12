"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { audit, requireAdmin } from "@/lib/admin";
import { generateVoice, timeWords } from "@/lib/ai/fal";
import { type AiConfig, type Provider, REASONINGS, SETTING_KEY, TEXT_PROVIDERS, TEXT_TASKS, V2_ROLES, forgetAiConfig, normalizeConfig, textClient, textCost, unitCost } from "@/lib/ai/models";
import { KEYS_SETTING, PROVIDERS, PROVIDER_NAME, type AnyProvider, forgetAiKeys, loadAiKeys, withKey } from "@/lib/ai/keys";
import { geminiSpeak, openaiSpeak } from "@/lib/ai/speech";

// /admin/models: which AI model does each job. Super admins only; every save
// is written to the audit log. Keys are never read back or shown.

async function superAdmin() {
  const s = await requireAdmin("models");
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
    text: { provider: text(formData, "text_provider"), model: text(formData, "text_model"), backup: formData.get("text_backup") === "on", openaiDirect: formData.get("text_openai_direct") === "on" },
    tasks: Object.fromEntries(TEXT_TASKS.map((t) => [t.id, { on: formData.get(`task_${t.id}_on`) === "on", provider: text(formData, `task_${t.id}_provider`), model: text(formData, `task_${t.id}_model`) }])),
    voice: { on: formData.get("voice_on") === "on", provider: text(formData, "voice_provider"), model: text(formData, "voice_model"), template: text(formData, "voice_template", 2000), female: text(formData, "voice_female", 80), male: text(formData, "voice_male", 80), choices: text(formData, "voice_choices", 4000), fallback: formData.get("voice_fallback") === "on" },
    prices,
    v2: { whisper: text(formData, "v2_whisper"), roles: Object.fromEntries(V2_ROLES.map((r) => [r.id, { provider: text(formData, `v2_${r.id}_provider`), model: text(formData, `v2_${r.id}_model`), reasoning: text(formData, `v2_${r.id}_reasoning`), on: r.id !== "reviewer", temperature: num(formData, `v2_${r.id}_temperature`) ?? null }])) },
  });
  // (a fal model's template is its JSON input; Google's and OpenAI's is plain words: how to say it)
  if (next.voice.provider === "fal" && !validTemplate(next.voice.template)) redirect("/admin/models?error=" + encodeURIComponent("An input template is not a valid JSON object."));
  const { data: before } = await s.db.from("app_settings").select("value").eq("key", SETTING_KEY).maybeSingle();
  if (JSON.stringify(before?.value ?? null) === JSON.stringify(next)) redirect("/admin/models?saved=0");
  const { error } = await s.db.from("app_settings").upsert({ key: SETTING_KEY, value: next, updated_at: new Date().toISOString(), updated_by: s.userId });
  if (error) redirect("/admin/models?error=" + encodeURIComponent(error.message));
  await audit(s, "ai_models.update", { type: "settings", id: SETTING_KEY }, { from: before?.value ?? null, to: next });
  forgetAiConfig();
  revalidatePath("/admin/models");
  redirect("/admin/models?saved=1");
}

// A provider's API key, saved encrypted (lib/ai/keys.ts) — or removed (the environment's is used again).
// The key itself is never written to the audit log, nor shown again.
export async function saveAiKey(formData: FormData) {
  const s = await superAdmin();
  const p = PROVIDERS.find((x) => x === text(formData, "provider")) as AnyProvider | undefined;
  if (!p) redirect("/admin/models?error=" + encodeURIComponent("Unknown provider."));
  const remove = formData.get("remove") === "1";
  const key = text(formData, "key", 500);
  if (!remove && (key.length < 12 || /\s/.test(key))) redirect("/admin/models?error=" + encodeURIComponent(`That doesn't look like a ${PROVIDER_NAME[p]} key.`));
  await loadAiKeys(true);
  const value = withKey(p, remove ? null : key);
  const { error } = await s.db.from("app_settings").upsert({ key: KEYS_SETTING, value, updated_at: new Date().toISOString(), updated_by: s.userId });
  if (error) redirect("/admin/models?error=" + encodeURIComponent(error.message));
  await audit(s, remove ? "ai_key.remove" : "ai_key.save", { type: "settings", id: KEYS_SETTING }, { provider: p, last4: remove ? null : key.slice(-4) });
  forgetAiKeys();
  forgetAiConfig();
  revalidatePath("/admin/models");
  redirect("/admin/models?saved=" + (remove ? "key-removed" : "key"));
}

const providerOf = (f: FormData): Provider => (TEXT_PROVIDERS.find((p) => p === text(f, "provider")) ?? "fal");

export type TestResult = { ok: boolean; ms?: number; output?: string; audioUrl?: string; tokens?: string; cost?: string; error?: string };

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
      const ai = textClient(providerOf(formData), model, false, { timeout: 60_000 }, true);
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
    if (kind === "voice" && (text(formData, "provider") === "google" || text(formData, "provider") === "openai")) {
      // (Google's or OpenAI's own speech: a Bangla line in the typed voice name)
      const sample = "আপনার ব্যবসার গল্প এখন সহজ ভিডিওতে, যা মানুষ মনে রাখবে।";
      const name = text(formData, text(formData, "gender") === "male" ? "male" : "female", 80) || text(formData, "female", 80) || text(formData, "male", 80);
      if (!model || !name) return { ok: false, error: "Type the voice model and a voice name." };
      const template = text(formData, "template", 2000);
      const r = text(formData, "provider") === "google" ? await geminiSpeak(model, template.includes("{{text}}") ? template.replace(/\{\{text\}\}/g, sample) : sample, name) : await openaiSpeak(model, sample, name, template.replace(/\{\{text\}\}/g, ""));
      const priced = unitCost(config, model, r.units, () => NaN);
      return { ok: true, ms: Date.now() - started, audioUrl: `data:${r.type};base64,${Buffer.from(r.bytes).toString("base64")}`, output: "Word timing: from the voice's pauses (no AI) — the video stays in sync.", cost: Number.isFinite(priced) ? `${usd(priced)} for ${r.units} ${text(formData, "provider") === "google" ? "audio tokens" : "characters"} (from your prices)` : `${r.units} ${text(formData, "provider") === "google" ? "audio tokens" : "characters"} — add a price per unit below` };
    }
    if (kind === "voice") {
      const sample = "This is a MotionBrief voice test. Your product, explained in thirty seconds.";
      const r = await generateVoice({ script: sample, language: "English", style: "Friendly", gender: text(formData, "gender") || "female" }, { on: true, model, template: text(formData, "template", 2000), female: text(formData, "female", 80), male: text(formData, "male", 80) });
      const priced = unitCost(config, r.model, sample.length, () => NaN);
      // Without the model's own word times, a video hears them with Whisper: try it here too.
      let heard = "";
      if (!r.words?.length) {
        try {
          const t = await timeWords(r.audioUrl, sample);
          heard = t ? `Word timing: heard by Whisper (${t.words.length} words) — videos with this voice stay in sync.` : "⚠ Word timing: the model gives none and Whisper heard nothing — videos would use an even reading pace.";
        } catch (e) {
          heard = `⚠ Word timing: the model gives none and Whisper failed (${e instanceof Error ? e.message.slice(0, 200) : e}) — videos would use an even reading pace.`;
        }
      }
      return { ok: true, ms: Date.now() - started, audioUrl: r.audioUrl, output: heard || `Word timing: yes, from the model (${r.words?.length ?? 0} words) — the video's text and scenes stay in sync with this voice.`, cost: Number.isFinite(priced) ? `${usd(priced)} for ${sample.length} characters (from your prices)` : `${sample.length} characters — add a price per character below` };
    }
    return { ok: false, error: "Unknown test." };
  } catch (e) {
    return { ok: false, ms: Date.now() - started, error: (e instanceof Error ? e.message : String(e)).slice(0, 500) };
  }
}

// The Director's test set (lib/simple/director-test.ts): every case read by
// the typed model with the typed reasoning, scored. About ten real calls.
export type DirectorTestResult = { ok: boolean; error?: string; run?: import("@/lib/simple/director-test").TestRun; cost?: string };
export async function testDirector(_prev: DirectorTestResult | null, formData: FormData): Promise<DirectorTestResult> {
  await superAdmin();
  const model = text(formData, "model");
  if (!model) return { ok: false, error: "Type a model name." };
  const reasoning = REASONINGS.find((r) => r === text(formData, "reasoning")) ?? "default";
  const t = text(formData, "temperature");
  const temperature = t === "" ? null : Number.isFinite(Number(t)) ? Math.max(0, Math.min(2, Number(t))) : null;
  const { getAiConfig } = await import("@/lib/ai/models");
  const { runDirectorTest } = await import("@/lib/simple/director-test");
  const config = await getAiConfig();
  try {
    const ai = { ...textClient(providerOf(formData), model, false, { timeout: 120_000 }, true), reasoning, temperature };
    const run = await runDirectorTest(ai);
    const priced = textCost(config, model, run.inputTokens, run.outputTokens, () => NaN);
    return { ok: run.cases.some((c) => !c.error), run, cost: Number.isFinite(priced) ? `$${priced.toFixed(4)} (from your prices)` : `${run.inputTokens} in · ${run.outputTokens} out tokens` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message.slice(0, 300) : String(e) };
  }
}
