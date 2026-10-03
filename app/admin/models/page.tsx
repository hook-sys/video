import { requireAdmin } from "@/lib/admin";
import { SETTING_KEY, TEXT_TASKS, normalizeConfig } from "@/lib/ai/models";
import { Badge, Card, Notice, PageHeader, Table, btnPrimary, input, td } from "../_components/ui";
import { daysAgo, usd } from "../_components/format";
import { saveAiModels } from "./actions";
import { ModelTest } from "./model-test";

export const metadata = { title: "AI models" };

// Suggestions only: any model name fal (or OpenAI) accepts can be typed.
const TEXT_MODELS = ["google/gemini-2.5-flash", "google/gemini-2.5-flash-lite", "google/gemini-2.5-pro", "openai/gpt-5-mini", "openai/gpt-5-nano", "openai/gpt-5", "anthropic/claude-haiku-4.5", "anthropic/claude-sonnet-4.5", "deepseek/deepseek-chat-v3.1", "qwen/qwen3-235b-a22b", "meta-llama/llama-4-maverick", "gpt-5-mini", "gpt-5-nano"];
const VOICE_MODELS = ["fal-ai/elevenlabs/tts/turbo-v2.5", "fal-ai/elevenlabs/tts/multilingual-v2", "fal-ai/minimax/speech-02-turbo", "fal-ai/minimax/speech-02-hd", "fal-ai/kokoro/american-english", "fal-ai/chatterbox/text-to-speech", "fal-ai/dia-tts"];
const IMAGE_MODELS = ["fal-ai/nano-banana-2", "fal-ai/flux/schnell", "fal-ai/flux/dev", "fal-ai/flux-pro/v1.1", "fal-ai/recraft/v3/text-to-image", "fal-ai/ideogram/v3"];

function Toggle({ name, on, disabled }: { name: string; on: boolean; disabled?: boolean }) {
  return (
    <label className={`flex items-center gap-3 ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>
      <input type="checkbox" name={name} defaultChecked={on} disabled={disabled} className="peer sr-only" />
      <span className="relative h-6 w-11 shrink-0 rounded-full bg-zinc-700 transition after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:transition peer-checked:bg-violet-500 peer-checked:after:translate-x-5" />
    </label>
  );
}
const select = `${input} md:w-36`;

export default async function ModelsPage({ searchParams }: PageProps<"/admin/models">) {
  const { saved, error } = await searchParams;
  const s = await requireAdmin();
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
  const env = { text: process.env.OPENAI_MODEL || "gpt-5-mini", voice: process.env.FAL_VOICE_MODEL || "—", image: process.env.FAL_IMAGE_MODEL || "—" };
  const keys = { fal: !!process.env.FAL_KEY, openai: !!process.env.OPENAI_API_KEY };
  const priceRows = [...Object.entries(c.prices), ...Array.from({ length: 4 }, () => ["", {}] as const)];

  return (
    <>
      <PageHeader title="AI models" sub="Which model does each job, and which jobs run. Applies to new videos within ~15 s; written to the audit log." />
      {typeof saved === "string" && <Notice>{saved === "0" ? "Nothing changed." : "Saved. New videos use these models."}</Notice>}
      {typeof error === "string" && <Notice tone="warn">{error}</Notice>}
      {!editable && <Notice tone="warn">Only a super admin can change these.</Notice>}
      <div className="flex flex-wrap gap-2 text-xs">
        <Badge tone={keys.fal ? "green" : "red"}>fal key {keys.fal ? "set" : "missing"}</Badge>
        <Badge tone={keys.openai ? "green" : "red"}>OpenAI key {keys.openai ? "set" : "missing"}</Badge>
        {row?.updated_at && <Badge>saved {new Date(row.updated_at).toLocaleString("en-GB")}</Badge>}
      </div>

      <datalist id="text-models">{TEXT_MODELS.map((m) => <option key={m} value={m} />)}</datalist>
      <datalist id="voice-models">{VOICE_MODELS.map((m) => <option key={m} value={m} />)}</datalist>
      <datalist id="image-models">{IMAGE_MODELS.map((m) => <option key={m} value={m} />)}</datalist>

      <form action={saveAiModels} className="flex flex-col gap-4">
        <fieldset disabled={!editable} className="flex flex-col gap-4">
          <Card title="Script & director — main model">
            <div className="flex flex-col gap-3 text-sm">
              <p className="text-zinc-500">
                On <b className="text-zinc-300">fal</b>, models are named like <code>google/gemini-2.5-flash</code> or <code>openai/gpt-5-mini</code> (fal&apos;s OpenRouter list). On <b className="text-zinc-300">OpenAI</b>, like <code>gpt-5-mini</code>. Environment default: <code>{env.text}</code> on OpenAI.
              </p>
              <div className="grid gap-2 md:grid-cols-[150px_1fr]">
                <select name="text_provider" defaultValue={c.text.provider} className={input}>
                  <option value="fal">fal</option>
                  <option value="openai">OpenAI (direct)</option>
                </select>
                <input name="text_model" list="text-models" defaultValue={c.text.model} className={input} />
              </div>
              <label className="flex items-center gap-3 text-zinc-300">
                <Toggle name="text_backup" on={c.text.backup} />
                Backup: when a fal call fails, try once on OpenAI ({env.text})
              </label>
            </div>
          </Card>

          <Card title="Text jobs">
            <div className="divide-y divide-white/[0.05]">
              {TEXT_TASKS.map((t) => {
                const v = c.tasks[t.id];
                return (
                  <div key={t.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 md:flex-row md:items-center">
                    <div className="flex flex-1 items-start gap-3">
                      <Toggle name={`task_${t.id}_on`} on={v.on} disabled={!t.canOff} />
                      {!t.canOff && <input type="hidden" name={`task_${t.id}_on`} value="on" />}
                      <div>
                        <p className="font-medium text-white">{t.label}</p>
                        <p className="mt-0.5 max-w-xl text-sm text-zinc-500">{t.help}</p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 md:w-[440px] md:flex-row">
                      <select name={`task_${t.id}_provider`} defaultValue={v.provider} className={select}>
                        <option value="">Main provider</option>
                        <option value="fal">fal</option>
                        <option value="openai">OpenAI</option>
                      </select>
                      <input name={`task_${t.id}_model`} list="text-models" defaultValue={v.model} placeholder="Main model" className={input} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card title="Voice (fal)" action={<Toggle name="voice_on" on={c.voice.on} />}>
            <div className="flex flex-col gap-3 text-sm">
              <p className="text-zinc-500">Off: videos have no voice; the visuals follow the script at an even reading pace. Empty fields use the environment (model <code>{env.voice}</code>).</p>
              <input name="voice_model" list="voice-models" defaultValue={c.voice.model} placeholder="Model, e.g. fal-ai/elevenlabs/tts/turbo-v2.5" className={input} />
              <textarea name="voice_template" rows={2} defaultValue={c.voice.template} placeholder='Input template (JSON). Placeholders: {{text}} {{voice}} {{language}} {{style}} {{gender}}. e.g. {"text":"{{text}}","voice":"{{voice}}"}' className={`${input} font-mono text-xs`} />
              <div className="grid gap-2 md:grid-cols-2">
                <input name="voice_female" defaultValue={c.voice.female} placeholder="Female voice name (this model's)" className={input} />
                <input name="voice_male" defaultValue={c.voice.male} placeholder="Male voice name (this model's)" className={input} />
              </div>
              <p className="text-xs text-zinc-500">Every fal voice model takes its own input fields and voice names — copy them from the model&apos;s API page on fal, then use the test below.</p>
            </div>
          </Card>

          <Card title="Images (fal)" action={<Toggle name="image_on" on={c.image.on} />}>
            <div className="flex flex-col gap-3 text-sm">
              <p className="text-zinc-500">Off: no AI images; scenes use screenshots, icons and shapes. Empty fields use the environment (model <code>{env.image}</code>). Images never show people or animals.</p>
              <input name="image_model" list="image-models" defaultValue={c.image.model} placeholder="Model, e.g. fal-ai/flux/schnell" className={input} />
              <textarea name="image_template" rows={2} defaultValue={c.image.template} placeholder='Input template (JSON). Placeholders: {{prompt}} {{aspect_ratio}} ("16:9") {{image_size}} ("landscape_16_9"). e.g. {"prompt":"{{prompt}}","aspect_ratio":"{{aspect_ratio}}"}. FLUX and Recraft get the video&apos;s size by themselves.' className={`${input} font-mono text-xs`} />
            </div>
          </Card>

          <Card title="Prices (USD)">
            <div className="flex flex-col gap-3 text-sm">
              <p className="text-zinc-500">For the cost of each video. Text: per 1M input / output tokens. Voice: per character. Image: per image. Copy them from the model&apos;s page on fal. A model without a price here uses the old environment pricing.</p>
              <div className="hidden gap-2 text-xs text-zinc-500 md:grid md:grid-cols-[1fr_120px_120px_120px]">
                <span>Model</span><span>Input / 1M</span><span>Output / 1M</span><span>Per char / image</span>
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
          <ModelTest defaults={{ text: { provider: c.text.provider, model: c.text.model }, voice: { model: c.voice.model, template: c.voice.template }, image: { model: c.image.model, template: c.image.template } }} />
        </Card>
      )}

      <Card title="Cost by model · last 7 days">
        <Table head={["Job", "Model", "Calls", "Videos", "Total", "Per video"]} empty="No AI costs recorded in the last 7 days.">
          {usage.map(([k, m]) => (
            <tr key={k}>
              <td className={td}>{m.op === "openai_brief" ? "Script / director" : m.op === "fal_voice" ? "Voice" : "Image"}</td>
              <td className={`${td} font-mono text-xs`}>{k.split("|")[1]}</td>
              <td className={td}>{m.calls}</td>
              <td className={td}>{m.videos.size}</td>
              <td className={td}>{usd(m.cost)}</td>
              <td className={td}>{usd(m.cost / Math.max(1, m.videos.size))}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
