import { requireAdmin } from "@/lib/admin";
import { REASONINGS, SETTING_KEY, TEXT_TASKS, V2_ROLES, normalizeConfig, voiceChoicesText } from "@/lib/ai/models";
import { VoicePresets } from "./voice-presets";
import { PROVIDERS, PROVIDER_ENV, PROVIDER_NAME, keyStatus, loadAiKeys } from "@/lib/ai/keys";
import { Badge, Card, Notice, PageHeader, btnPrimary, input } from "../_components/ui";
import { daysAgo, usd } from "../_components/format";
import { saveAiKey, saveAiModels } from "./actions";
import { ModelTest } from "./model-test";
import { DirectorTest } from "./director-test";

export const metadata = { title: "AI models" };
// (the Director test reads 10 scripts: up to a few minutes)
export const maxDuration = 300;

// Suggestions only: any model name fal (or OpenAI) accepts can be typed.
const TEXT_MODELS = ["gemini-2.5-flash-lite", "gemini-3.1-flash-lite", "gpt-5-nano", "gpt-5-mini", "claude-haiku-5-5", "claude-sonnet-5-5", "google/gemini-2.5-flash", "google/gemini-2.5-flash-lite", "google/gemini-2.5-pro", "openai/gpt-5-mini", "openai/gpt-5-nano", "openai/gpt-5", "anthropic/claude-haiku-4.5", "anthropic/claude-sonnet-4.5", "deepseek/deepseek-chat-v3.1", "qwen/qwen3-235b-a22b", "meta-llama/llama-4-maverick", "gpt-5-mini", "gpt-5-nano"];
const VOICE_MODELS = ["fal-ai/gemini-tts", "fal-ai/gemini-3.1-flash-tts", "gemini-3.8-flash-lite-tts", "gemini-3.8-flash-tts", "gpt-4o-mini-tts", "fal-ai/elevenlabs/tts/turbo-v2.5", "fal-ai/elevenlabs/tts/multilingual-v2", "fal-ai/minimax/speech-02-turbo", "fal-ai/minimax/speech-02-hd", "fal-ai/kokoro/american-english", "fal-ai/chatterbox/text-to-speech", "fal-ai/dia-tts"];


export default async function ModelsPage({ searchParams }: PageProps<"/admin/models">) {
  const { saved, error } = await searchParams;
  const s = await requireAdmin("models");
  const editable = s.role === "super_admin";
  const [{ data: row }, { data: events }] = await Promise.all([
    s.db.from("app_settings").select("value, updated_at").eq("key", SETTING_KEY).maybeSingle(),
    s.db.from("cost_events").select("project_id, operation, model, estimated_cost_usd").gte("created_at", daysAgo(7)).in("operation", ["openai_brief", "fal_voice", "fal_image"]).limit(20000),
  ]);
  const c = normalizeConfig(row?.value);
  // What each model cost over the last 7 days (as recorded), per video.
  const byModel = new Map<string, { op: string; cost: number; videos: Set<string>; calls: number }>();
  for (const e of events ?? []) {
    const k = `${e.operation}|${e.model ?? "—"}`;
    const m = byModel.get(k) ?? { op: e.operation, cost: 0, videos: new Set<string>(), calls: 0 };
    m.cost += Number(e.estimated_cost_usd);
    m.videos.add(e.project_id);
    m.calls++;
    byModel.set(k, m);
  }
  const usage = [...byModel.entries()].sort((a, b) => b[1].cost - a[1].cost);
  const env = { voice: process.env.FAL_VOICE_MODEL || "—" };
  await loadAiKeys(true);
  const keys = keyStatus();
  const priceRows = [...Object.entries(c.prices), ...Array.from({ length: 4 }, () => ["", {}] as const)];

  return (
    <>
      <PageHeader title="AI models" sub="Which model does each job, and which jobs run. Applies to new videos within ~15 s; written to the audit log." />
      {typeof saved === "string" && <Notice>{saved === "0" ? "Nothing changed." : saved === "key" ? "Key saved (encrypted). It is used from now on." : saved === "key-removed" ? "Key removed: the environment's key is used, if there is one." : "Saved. New videos use these models."}</Notice>}
      {typeof error === "string" && <Notice tone="warn">{error}</Notice>}
      {!editable && <Notice tone="warn">Only a super admin can change these.</Notice>}
      <div className="flex flex-wrap gap-2 text-xs">
        {PROVIDERS.map((p) => (
          <Badge key={p} tone={keys[p].source ? "green" : "red"}>{PROVIDER_NAME[p]} key {keys[p].source ? "set" : "missing"}</Badge>
        ))}
        {row?.updated_at && <Badge>saved {new Date(row.updated_at).toLocaleString("en-GB")}</Badge>}
      </div>

      <datalist id="text-models">{TEXT_MODELS.map((m) => <option key={m} value={m} />)}</datalist>
      <datalist id="voice-models">{VOICE_MODELS.map((m) => <option key={m} value={m} />)}</datalist>

      <Card title="AI providers — API keys">
        <div className="flex flex-col gap-3 text-sm">
          <p className="text-zinc-500">Each provider&apos;s key: saved here (encrypted, never shown again — only its last four) or from the environment. A saved key wins. Choose which provider does each job below.</p>
          {PROVIDERS.map((p) => (
            <form key={p} action={saveAiKey} className="grid items-center gap-2 md:grid-cols-[170px_1fr_auto_auto]">
              <input type="hidden" name="provider" value={p} />
              <span className="text-zinc-300">
                {PROVIDER_NAME[p]}
                {p === "google" && <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="block text-[11px] text-violet-300 hover:underline">Get a Gemini key ↗</a>}
                {p === "fal" && <a href="https://fal.ai/dashboard/keys" target="_blank" rel="noreferrer" className="block text-[11px] text-violet-300 hover:underline">Get a fal key ↗</a>}
                <span className="block text-xs text-zinc-500">{keys[p].source === "saved" ? `saved ••••${keys[p].last4}` : keys[p].source === "environment" ? `${PROVIDER_ENV[p]} ••••${keys[p].last4}` : "no key"}</span>
              </span>
              <input name="key" type="password" autoComplete="off" disabled={!editable} placeholder={`Paste a new ${PROVIDER_NAME[p]} key`} className={input} />
              <button disabled={!editable} className={btnPrimary}>Save key</button>
              {keys[p].source === "saved" ? (
                <button name="remove" value="1" disabled={!editable} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:bg-white/5">Remove</button>
              ) : (
                <span />
              )}
            </form>
          ))}
        </div>
      </Card>

      <form action={saveAiModels} className="flex flex-col gap-4">
        <fieldset disabled={!editable} className="flex flex-col gap-4">
          {/* (the models of jobs that no longer run: kept as they are, never shown) */}
          <input type="hidden" name="text_provider" value={c.text.provider} />
          <input type="hidden" name="text_model" value={c.text.model} />
          {c.text.openaiDirect && <input type="hidden" name="text_openai_direct" value="on" />}
          {c.text.backup && <input type="hidden" name="text_backup" value="on" />}
          {TEXT_TASKS.map((t) => (
            <span key={t.id} hidden>
              {c.tasks[t.id].on && <input type="hidden" name={`task_${t.id}_on`} value="on" />}
              <input type="hidden" name={`task_${t.id}_provider`} value={c.tasks[t.id].provider} />
              <input type="hidden" name={`task_${t.id}_model`} value={c.tasks[t.id].model} />
            </span>
          ))}
          {c.voice.fallback && <input type="hidden" name="voice_fallback" value="on" />}
          {V2_ROLES.filter((r) => r.id !== "director").map((r) => (
            <span key={r.id} hidden>
              <input type="hidden" name={`v2_${r.id}_provider`} value={c.v2.roles[r.id].provider} />
              <input type="hidden" name={`v2_${r.id}_model`} value={c.v2.roles[r.id].model} />
              <input type="hidden" name={`v2_${r.id}_reasoning`} value={c.v2.roles[r.id].reasoning} />
              <input type="hidden" name={`v2_${r.id}_temperature`} value={c.v2.roles[r.id].temperature ?? ""} />
            </span>
          ))}

          <Card title="Voice" action={c.voice.on ? <input type="hidden" name="voice_on" value="on" /> : null}>
            <div className="flex flex-col gap-3 text-sm">
              <VoicePresets />
              <label className="flex flex-col gap-1">
                <span className="text-zinc-400">Provider</span>
                <select name="voice_provider" defaultValue={c.voice.provider} className={input}>
                  <option value="google">Google — Gemini TTS (cheapest for Bangla: per audio token)</option>
                  <option value="openai">OpenAI — speech</option>
                  <option value="fal">fal — any voice model on fal</option>
                </select>
              </label>
              <p className="text-zinc-500">Template — fal: the model&apos;s JSON input. Google: best left empty — Gemini then speaks the script exactly; an instruction before {"{{text}}"} can be read aloud as part of the voice (test it first if you add one). OpenAI: how to say it (its instructions). Empty fal fields use the environment (model <code>{env.voice}</code>).</p>
              <input name="voice_model" list="voice-models" defaultValue={c.voice.model} placeholder="Model, e.g. fal-ai/elevenlabs/tts/turbo-v2.5" className={input} />
              <textarea name="voice_template" rows={2} defaultValue={c.voice.template} placeholder='Input template (JSON). Placeholders: {{text}} {{voice}} {{language}} {{style}} {{gender}}. e.g. {"text":"{{text}}","voice":"{{voice}}"}' className={`${input} font-mono text-xs`} />
              <div className="grid gap-2 md:grid-cols-2">
                <input name="voice_female" defaultValue={c.voice.female} placeholder="Female voice name (this model's)" className={input} />
                <input name="voice_male" defaultValue={c.voice.male} placeholder="Male voice name (this model's)" className={input} />
              </div>
              {c.voice.model && (!c.voice.female || !c.voice.male) && !(["female", "male"] as const).every((g) => c.voice[g] || c.voice.choices.some((v) => v.gender === g)) && (
                <p className="rounded-lg border border-amber-400/20 bg-amber-500/5 p-2 text-xs text-amber-200">Set both a female and a male voice name for this model (or list both genders below): a video in the missing gender can&apos;t be voiced.</p>
              )}
              <label className="flex flex-col gap-1.5">
                <span className="text-zinc-300">Voices customers can pick</span>
                <textarea name="voice_choices" rows={4} defaultValue={voiceChoicesText(c.voice.choices)} placeholder={"One per line: name, female or male, a short description\nKore, female, Warm and clear\nPuck, male, Upbeat"} className={`${input} font-mono text-xs`} />
                <span className="text-xs text-zinc-500">Names of the voice model above, spelled exactly (they are case-sensitive: Kore, not kore). Shown on the new-video form; empty = customers only pick male or female. Test each name below first.</span>
              </label>
              <p className="text-xs text-zinc-500">Every fal voice model takes its own input fields and voice names — copy them from the model&apos;s API page on fal, then use the test below.</p>
            </div>
          </Card>

          <Card title="Director & Whisper">
            <div className="flex flex-col gap-3 text-sm">
              <p className="text-zinc-500">
                The Director reads the voice, beat by beat (what each beat is, the words to show, an icon, the things it names), through the provider chosen beside it — Google, OpenAI or Anthropic directly, or fal&apos;s router (model names like google/gemini-2.5-flash there). Nothing falls back: a missing model stops the video with an error and its credits go back. Reasoning: <i>default</i> = the model&apos;s own; <i>none</i> = none asked. Temperature (empty = the model&apos;s own) is sent only with reasoning default or none. Choose them with the Director test below.
              </p>
              {(() => {
                const v = c.v2.roles.director;
                return (
                  <div className="flex flex-col gap-2 rounded-lg border border-white/[0.06] p-3">
                    <p className="font-medium text-white">Director</p>
                    {!v.model && <p className="rounded-lg border border-amber-400/20 bg-amber-500/5 p-2 text-xs text-amber-200">No model yet: new videos stop with an error until one is set.</p>}
                    <div className="grid gap-2 md:grid-cols-[170px_1fr_150px_150px]">
                      <select name="v2_director_provider" defaultValue={v.provider} className={input}>
                        {PROVIDERS.map((p) => (
                          <option key={p} value={p}>{PROVIDER_NAME[p]}</option>
                        ))}
                      </select>
                      <input name="v2_director_model" list="text-models" defaultValue={v.model} placeholder="e.g. google/gemini-2.5-flash" className={input} />
                      <input name="v2_director_temperature" type="number" min={0} max={2} step="0.05" defaultValue={v.temperature ?? ""} placeholder="temperature: model's" className={input} />
                      <select name="v2_director_reasoning" defaultValue={v.reasoning} className={input}>
                        {REASONINGS.map((x) => (
                          <option key={x} value={x}>
                            reasoning: {x}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })()}
              <label className="flex flex-col gap-1">
                <span className="text-zinc-400">Whisper model (only a fallback: the voice is timed by its pauses, no AI)</span>
                <input name="v2_whisper" defaultValue={c.v2.whisper} placeholder="e.g. fal-ai/whisper" className={input} />
              </label>
            </div>
          </Card>

          <Card title="Prices (USD)">
            <div className="flex flex-col gap-3 text-sm">
              <p className="text-zinc-500">For the cost of each video. Text: per 1M input / output tokens. Voice: per unit — a character (fal, OpenAI) or an audio token (Google Gemini TTS: about 25 a second). Copy them from the provider&apos;s pricing page. A model without a price here uses the old environment pricing.</p>
              <div className="hidden gap-2 text-xs text-zinc-500 md:grid md:grid-cols-[1fr_120px_120px_120px]">
                <span>Model</span><span>Input / 1M</span><span>Output / 1M</span><span>Per unit</span>
              </div>
              {priceRows.map(([model, p], i) => (
                <div key={i} className="grid gap-2 md:grid-cols-[1fr_120px_120px_120px]">
                  <input name={`price_model_${i}`} defaultValue={model} list="text-models" placeholder="model name" className={input} />
                  <input name={`price_in_${i}`} defaultValue={"in" in p && p.in !== undefined ? p.in : ""} inputMode="decimal" placeholder="—" className={input} />
                  <input name={`price_out_${i}`} defaultValue={"out" in p && p.out !== undefined ? p.out : ""} inputMode="decimal" placeholder="—" className={input} />
                  <input name={`price_unit_${i}`} defaultValue={"unit" in p && p.unit !== undefined ? p.unit : ""} inputMode="decimal" placeholder="—" className={input} />
                </div>
              ))}
            </div>
          </Card>
        </fieldset>
        {editable && (
          <div className="flex justify-end">
            <button className={btnPrimary}>Save AI models</button>
          </div>
        )}
      </form>

      {editable && (
        <Card title="Test a model">
          <ModelTest defaults={{ text: { provider: c.v2.roles.director.provider, model: c.v2.roles.director.model }, voice: { provider: c.voice.provider, model: c.voice.model, template: c.voice.template } }} />
        </Card>
      )}

      {editable && (
        <Card title="Director test">
          <DirectorTest defaults={{ provider: c.v2.roles.director.provider, model: c.v2.roles.director.model, reasoning: c.v2.roles.director.reasoning, temperature: c.v2.roles.director.temperature }} reasonings={REASONINGS} />
        </Card>
      )}

      <Card title="Cost by model · last 7 days">
        {/* (a list, not a table: the model name stays visible on a phone) */}
        {usage.length ? (
          <div className="divide-y divide-white/[0.05] text-sm">
            {usage.map(([k, m]) => (
              <div key={k} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                <p className="flex flex-wrap items-center gap-2">
                  <Badge tone={m.op === "openai_brief" ? "violet" : m.op === "fal_voice" ? "blue" : "amber"}>{m.op === "openai_brief" ? "Script / director" : m.op === "fal_voice" ? "Voice" : "Image"}</Badge>
                  <span className="break-all font-mono text-xs text-white">{k.split("|")[1]}</span>
                </p>
                <p className="text-zinc-400">
                  {m.calls} calls · {m.videos.size} videos · total <b className="text-zinc-200">{usd(m.cost)}</b> · per video <b className="text-zinc-200">{usd(m.cost / Math.max(1, m.videos.size))}</b>
                  {m.cost === 0 && <span className="text-amber-300"> · no price set for this model</span>}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-500">No AI costs recorded in the last 7 days.</p>
        )}
      </Card>
    </>
  );
}
