import OpenAI from "openai";
import type { BriefUsage } from "@/lib/ai/product-brief";

// Which AI model does each job, and whether the job runs at all — chosen by a
// super admin on /admin/models (app_settings key "ai_models"). Nothing stored
// yet means the environment's models, so behaviour only changes when an admin
// saves something.
//
// Text jobs run through fal (its OpenAI-compatible OpenRouter endpoint: GPT,
// Gemini, Claude, Llama … by name, e.g. "google/gemini-2.5-flash") or OpenAI
// directly — only while "OpenAI direct" is on (a separate OpenAI bill); off,
// an "OpenAI" job runs the same model through fal ("openai/<model>"). With
// "backup" on (and OpenAI direct on), a failed fal call is retried once on OpenAI.

export const TEXT_TASKS = [
  { id: "brief", label: "Script & brief", help: "Reads the website, screenshots' text and the customer's script, and writes the brief. Every video needs it, so it can't be turned off.", canOff: false },
  { id: "screenshots", label: "Screenshot reading", help: "Reads uploaded screenshots (needs a model that accepts images). Off: screenshots are still shown in the video, just not read.", canOff: true },
  { id: "composer", label: "Composer Director", help: "Composes the Composer engine's videos scene by scene (only when the Composer engine is on). Off: the Composer's own rule-based director composes them.", canOff: true },
  { id: "clean", label: "Studio Director", help: "Splits the narration into the studio's parts (new engine, 16:9). Off: a rule-based split is used instead.", canOff: true },
  { id: "shot", label: "Shot Director (old engine)", help: "Plans the old engine's shots. Off: skipped; the Scene Director is tried next.", canOff: true },
  { id: "scene", label: "Scene Director (old engine)", help: "Old engine, used when the Shot Director gave nothing. Off: skipped.", canOff: true },
  { id: "flow", label: "Flow Director (old engine)", help: "Old engine's last fallback. Off: skipped.", canOff: true },
  { id: "story", label: "Visual Story (preview engine)", help: "Only used when VISUAL_ENGINE=story. Off: skipped.", canOff: true },
] as const;
export type TextTask = (typeof TEXT_TASKS)[number]["id"];
export type Provider = "fal" | "openai";

export type ModelPrice = { in?: number; out?: number; unit?: number };
export type AiConfig = {
  text: { provider: Provider; model: string; backup: boolean; openaiDirect: boolean };
  // per job: on/off, and a model (and provider) other than the main one
  tasks: Record<TextTask, { on: boolean; provider: Provider | ""; model: string }>;
  // empty strings mean the environment's values
  // fallback: when the chosen model fails, the environment's voice speaks (it is paid too)
  voice: { on: boolean; model: string; template: string; female: string; male: string; choices: VoiceChoice[]; fallback: boolean };
  image: { on: boolean; model: string; template: string };
  // USD: per 1M input / output tokens (text), per character (voice), per image
  prices: Record<string, ModelPrice>;
  // the Composer engine (every scene composed by its Director): off, for
  // admins' projects only (to compare with the studio), or for everyone
  engine: { composer: ComposerMode };
};
export type ComposerMode = "off" | "admins" | "all";

// A voice customers can pick on the form (a name of the voice model's).
export type VoiceChoice = { name: string; gender: "female" | "male"; label: string };
// One per line: "Kore, female, Warm and clear"
export function parseVoiceChoices(raw: unknown): VoiceChoice[] {
  const rows: unknown[] = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(/\r?\n/) : [];
  const out: VoiceChoice[] = [];
  for (const r of rows) {
    const o = typeof r === "string" ? (([name, gender, ...label]) => ({ name, gender, label: label.join(",") }))(r.split(",").map((x) => x.trim())) : (r as Record<string, unknown>);
    const name = str(o?.name, 60);
    if (!name || /[\r\n]/.test(name) || out.some((c) => c.name === name)) continue;
    out.push({ name, gender: String(o?.gender ?? "").toLowerCase().startsWith("m") ? "male" : "female", label: str(o?.label, 80) });
  }
  return out.slice(0, 30);
}
export const voiceChoicesText = (c: VoiceChoice[]) => c.map((v) => [v.name, v.gender, v.label].filter(Boolean).join(", ")).join("\n");

export const SETTING_KEY = "ai_models";
export const FAL_LLM_URL = "https://fal.run/openrouter/router/openai/v1";

export function defaultConfig(): AiConfig {
  return {
    text: { provider: "openai", model: process.env.OPENAI_MODEL || "gpt-5-mini", backup: false, openaiDirect: false },
    tasks: Object.fromEntries(TEXT_TASKS.map((t) => [t.id, { on: true, provider: "", model: "" }])) as AiConfig["tasks"],
    voice: { on: true, model: "", template: "", female: "", male: "", choices: [], fallback: false },
    image: { on: true, model: "", template: "" },
    prices: {},
    engine: { composer: "off" },
  };
}

const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
const provider = (v: unknown): Provider | "" => (v === "fal" || v === "openai" ? v : "");
const price = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined);

// Whatever is stored, read defensively over the defaults.
export function normalizeConfig(raw: unknown): AiConfig {
  const d = defaultConfig();
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, Record<string, unknown> | undefined>;
  const tasks = (r.tasks ?? {}) as Record<string, Record<string, unknown> | undefined>;
  const prices = (r.prices ?? {}) as Record<string, Record<string, unknown> | undefined>;
  return {
    text: { provider: provider(r.text?.provider) || d.text.provider, model: str(r.text?.model) || d.text.model, backup: bool(r.text?.backup, false), openaiDirect: bool(r.text?.openaiDirect, false) },
    tasks: Object.fromEntries(
      TEXT_TASKS.map((t) => [t.id, { on: t.canOff ? bool(tasks[t.id]?.on, true) : true, provider: provider(tasks[t.id]?.provider), model: str(tasks[t.id]?.model) }]),
    ) as AiConfig["tasks"],
    voice: { on: bool(r.voice?.on, true), model: str(r.voice?.model), template: str(r.voice?.template, 2000), female: str(r.voice?.female, 80), male: str(r.voice?.male, 80), choices: parseVoiceChoices(r.voice?.choices), fallback: bool(r.voice?.fallback, false) },
    image: { on: bool(r.image?.on, true), model: str(r.image?.model), template: str(r.image?.template, 2000) },
    prices: Object.fromEntries(
      Object.entries(prices)
        .filter(([k]) => k.trim())
        .map(([k, p]) => [k.trim().slice(0, 200), { in: price(p?.in), out: price(p?.out), unit: price(p?.unit) }]),
    ),
    engine: { composer: (["off", "admins", "all"] as const).find((m) => m === r.engine?.composer) ?? "off" },
  };
}

// Read from the database at most every 15 s; any failure (no database, as in
// the offline checks) means the defaults.
let cached: { at: number; config: AiConfig } | null = null;
export async function getAiConfig(): Promise<AiConfig> {
  if (cached && Date.now() - cached.at < 15_000) return cached.config;
  let config = defaultConfig();
  try {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const { data } = await createAdminClient().from("app_settings").select("value").eq("key", SETTING_KEY).maybeSingle();
      config = normalizeConfig(data?.value);
    }
  } catch {
    // (defaults)
  }
  cached = { at: Date.now(), config };
  return config;
}
export const forgetAiConfig = () => void (cached = null);

// Cost of one text call: the admin's price for the model, else the
// environment's pricing (lib/costs/pricing.ts, passed in by the caller).
export function textCost(config: AiConfig, model: string, inputTokens: number, outputTokens: number, fallback: () => number) {
  const p = config.prices[model];
  if (p?.in === undefined && p?.out === undefined) return fallback();
  return (inputTokens / 1e6) * (p.in ?? 0) + (outputTokens / 1e6) * (p.out ?? 0);
}
// Adds one call's usage; a cost the provider reported is kept as it is.
type CallUsage = { input_tokens?: number; output_tokens?: number; cost?: number } | null | undefined;
export function countUsage(u: BriefUsage, r: CallUsage) {
  const i = r?.input_tokens ?? 0;
  const o = r?.output_tokens ?? 0;
  const before = { in: u.unreportedIn ?? (u.reportedUsd === undefined ? u.inputTokens : 0), out: u.unreportedOut ?? (u.reportedUsd === undefined ? u.outputTokens : 0) };
  u.inputTokens += i;
  u.outputTokens += o;
  const cost = (r as { cost?: unknown } | null | undefined)?.cost;
  if (typeof cost === "number" && Number.isFinite(cost)) {
    u.reportedUsd = (u.reportedUsd ?? 0) + cost;
    u.unreportedIn = before.in;
    u.unreportedOut = before.out;
  } else if (u.reportedUsd !== undefined) {
    u.unreportedIn = before.in + i;
    u.unreportedOut = before.out + o;
  }
}
// A usage's cost: what the provider reported, plus its other tokens priced.
export function usageCost(config: AiConfig, u: BriefUsage, fallback: (inputTokens: number, outputTokens: number) => number) {
  const reported = u.reportedUsd;
  const i = reported === undefined ? u.inputTokens : (u.unreportedIn ?? 0);
  const o = reported === undefined ? u.outputTokens : (u.unreportedOut ?? 0);
  return (reported ?? 0) + (i || o ? textCost(config, u.model, i, o, () => fallback(i, o)) : 0);
}
export const unitCost = (config: AiConfig, model: string, units: number, fallback: () => number) => {
  const p = config.prices[model]?.unit;
  return p === undefined ? fallback() : units * p;
};

// The client a text job calls: `responses.parse` as the directors already use
// it, whichever provider answers.
export type ResponsesClient = Pick<OpenAI, "responses">;
export type TextAi = { client: ResponsesClient; model: string; provider: Provider; quick: boolean };

// gpt-5 / o-series reasoning models get low effort (as before).
const reasoning = (model: string) => /(^|\/)(gpt-5|o\d)/.test(model);

export async function textAi(task: TextTask, opts: { timeout?: number; maxRetries?: number } = {}): Promise<TextAi | null> {
  const config = await getAiConfig();
  const t = config.tasks[task];
  if (!t.on) return null;
  const prov = t.provider || config.text.provider;
  // A job moved to the other provider without its own model: the main model,
  // named the way that provider names it ("openai/gpt-5-mini" on fal).
  const main = config.text.model;
  const model = t.model || (prov === config.text.provider ? main : prov === "fal" ? (main.includes("/") ? main : `openai/${main}`) : main.replace(/^openai\//, ""));
  return textClient(prov, model, config.text.backup, opts, config.text.openaiDirect);
}

// A client for any provider and model (also used by the admin page's test).
export function textClient(prov: Provider, model: string, backupOn: boolean, opts: { timeout?: number; maxRetries?: number } = {}, direct = false): TextAi {
  // OpenAI direct off: the OpenAI model through fal, and no OpenAI backup
  if (prov === "openai" && !direct) return textClient("fal", model.includes("/") ? model : `openai/${model}`, false, opts, false);
  if (!direct) backupOn = false;
  if (prov === "openai") {
    if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured.");
    return { client: new OpenAI({ timeout: opts.timeout, maxRetries: opts.maxRetries ?? 0 }), model, provider: prov, quick: reasoning(model) };
  }
  if (!process.env.FAL_KEY) throw new Error("FAL_KEY is not configured.");
  const fal = falResponses(opts);
  const backup = backupOn && process.env.OPENAI_API_KEY ? new OpenAI({ timeout: opts.timeout, maxRetries: 0 }) : null;
  const fallbackModel = process.env.OPENAI_MODEL || "gpt-5-mini";
  const viaBackup = (body: Parameters<OpenAI["responses"]["parse"]>[0], options?: { timeout?: number }) =>
    backup!.responses.parse({ ...body, model: fallbackModel, ...(reasoning(fallbackModel) ? { reasoning: { effort: "low" } } : { reasoning: undefined }) } as typeof body, options);
  const client: ResponsesClient = {
    responses: {
      parse: (async (body: Parameters<OpenAI["responses"]["parse"]>[0], options?: { timeout?: number }) => {
        const prev = (body as { previous_response_id?: string }).previous_response_id;
        // a revision of an answer the backup gave stays with the backup
        if (backup && prev && !fal.knows(prev)) return viaBackup(body, options);
        try {
          return await fal.responses.parse(body, options);
        } catch (e) {
          if (!backup) throw e;
          console.warn("fal text call failed; OpenAI backup:", { model: body.model, backup: fallbackModel, error: e instanceof Error ? e.message.slice(0, 200) : String(e) });
          // (fresh for OpenAI: fal's response ids mean nothing there)
          const { previous_response_id, ...rest } = body as typeof body & { previous_response_id?: string };
          return viaBackup({ ...rest, input: previous_response_id ? fal.history(previous_response_id, rest.input) : rest.input } as typeof body, options);
        }
      }) as OpenAI["responses"]["parse"],
    } as OpenAI["responses"],
  };
  return { client, model, provider: prov, quick: reasoning(model) };
}

// ── fal: Chat Completions behind a `responses.parse` shim ─────────────────
type Msg = OpenAI.Chat.ChatCompletionMessageParam;
type ParseFormat = { type: string; name?: string; schema?: Record<string, unknown>; $parseRaw?: (s: string) => unknown };

// Responses-style input → chat messages (text and image parts).
function toMessages(input: unknown): Msg[] {
  if (typeof input === "string") return [{ role: "user", content: input }];
  if (!Array.isArray(input)) return [];
  return input.flatMap((m: { role?: string; content?: unknown }) => {
    const role = m.role === "assistant" ? "assistant" : m.role === "system" || m.role === "developer" ? "system" : "user";
    if (typeof m.content === "string") return [{ role, content: m.content } as Msg];
    if (!Array.isArray(m.content)) return [];
    type Part = OpenAI.Chat.ChatCompletionContentPartText | OpenAI.Chat.ChatCompletionContentPartImage;
    const parts = m.content.flatMap((p: { type?: string; text?: string; image_url?: string }): Part[] =>
      p.type === "input_text" || p.type === "output_text" || p.type === "text"
        ? [{ type: "text" as const, text: p.text ?? "" }]
        : p.type === "input_image" && p.image_url
          ? [{ type: "image_url" as const, image_url: { url: p.image_url } }]
          : [],
    );
    return [(role === "user" ? { role, content: parts } : { role, content: parts.map((p) => ("text" in p ? p.text : "")).join("\n") }) as Msg];
  });
}

const stripFences = (s: string) => s.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");

function falResponses(opts: { timeout?: number; maxRetries?: number }) {
  const chat = new OpenAI({
    baseURL: process.env.FAL_LLM_BASE_URL || FAL_LLM_URL, // (a local stand-in in the checks)
    apiKey: "fal",
    defaultHeaders: { Authorization: `Key ${process.env.FAL_KEY}` },
    timeout: opts.timeout,
    maxRetries: opts.maxRetries ?? 0,
  });
  // previous_response_id → the conversation so far (fal keeps no state)
  const threads = new Map<string, Msg[]>();
  const history = (id: string, input: unknown) => [...(threads.get(id) ?? []), ...toMessages(input)].filter((m) => m.role !== "system") as unknown as typeof input;

  async function parse(body: Record<string, unknown>, options?: { timeout?: number }) {
    const model = String(body.model);
    const format = ((body.text as { format?: ParseFormat } | undefined)?.format ?? null) as ParseFormat | null;
    const prior = typeof body.previous_response_id === "string" ? (threads.get(body.previous_response_id) ?? []) : [];
    const system: Msg[] = body.instructions ? [{ role: "system", content: String(body.instructions) }] : [];
    const messages: Msg[] = [...system, ...prior.filter((m) => m.role !== "system"), ...toMessages(body.input)];
    const effort = (body.reasoning as { effort?: string } | undefined)?.effort;
    const ask = (strict: boolean) =>
      chat.chat.completions.create(
        {
          model,
          messages: strict || !format?.schema ? messages : [{ role: "system", content: `${body.instructions ?? ""}\n\nReturn only one JSON object (no prose, no code fences) that matches this JSON Schema:\n${JSON.stringify(format.schema)}` }, ...messages.slice(system.length)],
          ...(format?.schema
            ? { response_format: strict ? { type: "json_schema", json_schema: { name: format.name ?? "output", strict: true, schema: format.schema } } : { type: "json_object" } }
            : {}),
          ...(effort ? { reasoning: { effort } } : {}),
        } as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming,
        options?.timeout ? { timeout: options.timeout } : undefined,
      );
    let res: OpenAI.Chat.ChatCompletion;
    try {
      res = await ask(true);
    } catch (e) {
      // a model without strict JSON-schema output: plain JSON mode, schema in the prompt
      const status = (e as { status?: number }).status;
      if (!format?.schema || (status !== 400 && status !== 422)) throw e;
      res = await ask(false);
    }
    const text = res.choices?.[0]?.message?.content ?? "";
    const id = res.id || `fal-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    threads.set(id, [...messages.filter((m) => m.role !== "system"), { role: "assistant", content: text }]);
    let parsed: unknown = null;
    if (format?.$parseRaw && text.trim()) parsed = format.$parseRaw(stripFences(text));
    const usage = res.usage as (OpenAI.CompletionUsage & { cost?: number }) | undefined;
    return {
      id,
      model,
      output_text: text,
      output_parsed: parsed,
      usage: usage ? { input_tokens: usage.prompt_tokens ?? 0, output_tokens: usage.completion_tokens ?? 0, total_tokens: usage.total_tokens ?? 0, ...(typeof usage.cost === "number" ? { cost: usage.cost } : {}) } : null,
    };
  }
  return {
    responses: { parse: parse as unknown as OpenAI["responses"]["parse"] },
    history,
    knows: (id: string) => threads.has(id),
  };
}
