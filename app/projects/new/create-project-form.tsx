"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { TierId } from "@/lib/billing-config";
import { createProject } from "@/app/projects/actions";
import { WaitingScreen } from "@/components/waiting/waiting-screen";
import { BRAND_CATEGORIES } from "@/lib/studio";
import { CATEGORY_LABEL, MOOD_CHOICES, OLD_WAYS, USES, USE_LABEL } from "@/lib/project-details";
import { AUDIENCE_MAX, BRAND_NAME_MAX, CTA_MAX, directionFor, VOICE_SCRIPT_MAX, FORMATS, LOGO_MAX_BYTES, STYLE_PRESETS, VOICE_GENDERS, VOICE_LANGUAGES, VOICE_STYLES, estimateVideoSeconds, validateLogo, type StylePreset } from "@/lib/projects";

const label = "text-sm font-medium";
const hint = "text-xs text-foreground/50";
const input =
  "w-full rounded-xl border border-foreground/12 bg-white/80 px-3.5 py-2.5 text-sm placeholder:text-foreground/35 focus:border-[#0a66d6] focus:outline-none focus:ring-4 focus:ring-[#0a66d6]/15";
const area =
  "w-full resize-y rounded-2xl border border-foreground/12 bg-white/80 p-4 text-base leading-relaxed placeholder:text-foreground/35 focus:border-[#0a66d6] focus:outline-none focus:ring-4 focus:ring-[#0a66d6]/15";

// No style to pick: the Motion Director decides the look from the answers.
const STYLE: StylePreset = "Auto";

export type Prefill = { script: string; brandName: string; websiteUrl: string; cta: string; voice?: string };
type VoiceOption = { name: string; gender: "female" | "male"; label: string };

// The brand's colour, read from its icon: the most common colourful shade
// (a black, white or grey icon gives the house blue).
async function colourOf(url: string): Promise<string> {
  const img = new Image();
  img.src = url;
  await img.decode();
  const c = document.createElement("canvas");
  c.width = c.height = 48;
  const g = c.getContext("2d");
  if (!g) return "#0A66D6";
  g.drawImage(img, 0, 0, 48, 48);
  const px = g.getImageData(0, 0, 48, 48).data;
  const bins = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < px.length; i += 4) {
    const [r, gr, b, a] = [px[i], px[i + 1], px[i + 2], px[i + 3]];
    const max = Math.max(r, gr, b), min = Math.min(r, gr, b);
    if (a < 200 || max < 40 || max - min < 40) continue;
    const hue = max === r ? ((gr - b) / (max - min) + 6) % 6 : max === gr ? (b - r) / (max - min) + 2 : (r - gr) / (max - min) + 4;
    const k = Math.round(hue * 2) % 12;
    const bin = bins.get(k) ?? { n: 0, r: 0, g: 0, b: 0 };
    bins.set(k, { n: bin.n + 1, r: bin.r + r, g: bin.g + gr, b: bin.b + b });
  }
  const best = [...bins.values()].sort((a, b) => b.n - a.n)[0];
  if (!best || best.n < 12) return "#0A66D6";
  const hex = (v: number) => Math.round(v / best.n).toString(16).padStart(2, "0");
  return `#${hex(best.r)}${hex(best.g)}${hex(best.b)}`.toUpperCase();
}

// A quality level as the form shows it (lib/billing-config: no model names).
export type Level = { id: TierId; name: string; blurb: string; badge: string; perSecond: number; soon: boolean; locked: boolean };

// scriptMax: shorter for a customer on welcome credits only (/admin/billing)
export function CreateProjectForm({ prefill, voices = [], levels = [], minSeconds = 0, credits = null, scriptMax = VOICE_SCRIPT_MAX }: { prefill?: Prefill; voices?: VoiceOption[]; levels?: Level[]; minSeconds?: number; credits?: number | null; scriptMax?: number }) {
  const [state, action, pending] = useActionState(createProject, {});
  const [script, setScript] = useState(prefill?.script ?? "");
  const [format, setFormat] = useState<string>(FORMATS[0]);
  const [logo, setLogo] = useState<{ name: string; url: string; colour: string | null } | null>(null);
  const [logoError, setLogoError] = useState<string>();
  const [before, setBefore] = useState<string[]>([]);
  const [localError, setLocalError] = useState<string>();
  const error = logoError ?? localError ?? state.error;
  const seconds = script.trim() ? estimateVideoSeconds(script) : 0;
  const [quality, setQuality] = useState<TierId>("standard");
  const level = levels.find((l) => l.id === quality);
  // (the team is not charged: credits null; the estimate is never shown — the
  // real charge follows the voice's length — only used to say credits are short)
  const cost = level && credits !== null ? Math.ceil(Math.max(minSeconds, Math.ceil(seconds || minSeconds)) * level.perSecond) : 0;
  const short = credits !== null && cost > credits;
  const blocked = pending || !!logoError;

  const submit = (
    <button disabled={blocked} className="w-full rounded-full bg-[#0a66d6] px-6 py-4 text-base font-semibold text-white hover:bg-[#0859bd] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#0a66d6]/30 disabled:opacity-60">
      Create video
    </button>
  );
  const balance = credits !== null && (
    <p className="text-center text-[11px] text-foreground/50">
      You have {credits.toLocaleString("en-US")} credits ·{" "}
      <Link href="/billing" className="font-medium text-[#0a66d6] hover:underline">
        {short ? "add credits to create this video" : "add credits"}
      </Link>
    </p>
  );

  return (
    <>
      {pending && <WaitingScreen />}
      <form
        action={action}
        onSubmit={(e) => {
          // (a group of checkboxes can't be "required" in HTML)
          if (!before.length) {
            e.preventDefault();
            setLocalError("Choose what your customers used before.");
            document.getElementById("before")?.scrollIntoView({ block: "center" });
          } else setLocalError(undefined);
        }}
        className={`grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] ${pending ? "hidden" : ""}`}
      >
        <input type="hidden" name="direction" value={directionFor(script, STYLE)} />
        <input type="hidden" name="visual_style" value={STYLE_PRESETS[STYLE].visual_style} />
        <input type="hidden" name="format" value={format} />
        <input type="hidden" name="quality" value={quality} />
        <input type="hidden" name="brand_color" value={logo?.colour ?? ""} />
        {/* Voice style isn't offered to customers; keep the existing default. */}
        <input type="hidden" name="voice_style" value={VOICE_STYLES[0]} />

        <div className="flex min-w-0 flex-col gap-5">
          <Step n={1} title="Your voice-over" sub="Exactly what the voice will say. The video lasts as long as the voice.">
            <textarea
              required
              rows={7}
              maxLength={scriptMax}
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder="Paste your short script… e.g. Running an online store means juggling orders, stock and couriers. SeloraX brings it all into one dashboard…"
              className={area}
            />
            <div className="flex items-center justify-between">
              <span className={hint}>{seconds ? `≈ ${seconds} s video` : "About 15 s per 250 characters"}</span>
              <span className={`${hint} tabular-nums ${script.length > scriptMax ? "font-semibold text-red-600" : ""}`}>
                {script.length}/{scriptMax}
              </span>
            </div>
            {scriptMax < VOICE_SCRIPT_MAX && (
              <p className={hint}>
                Welcome credits: a script up to {scriptMax} characters (about 15 s).{" "}
                <Link href="/billing" className="font-medium text-[#0a66d6] hover:underline">Buy credits</Link> for longer scripts.
              </p>
            )}
          </Step>

          <Step n={2} title="Your brand" sub="Your icon and name reveal the product and close the video.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Upload
                title="Icon"
                text={logo ? logo.name : "Upload your icon"}
                sub={`PNG, JPG or WebP · up to ${LOGO_MAX_BYTES / 1024 / 1024} MB`}
                preview={
                  logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logo.url} alt="" className="max-h-12 max-w-[70%] object-contain" />
                  ) : undefined
                }
              >
                <input
                  name="logo"
                  type="file"
                  required
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (logo) URL.revokeObjectURL(logo.url);
                    const problem = validateLogo(file);
                    setLogoError(problem);
                    if (!file || problem) return setLogo(null);
                    const url = URL.createObjectURL(file);
                    setLogo({ name: file.name, url, colour: null });
                    colourOf(url)
                      .then((colour) => setLogo((l) => (l?.url === url ? { ...l, colour } : l)))
                      .catch(() => setLogo((l) => (l?.url === url ? { ...l, colour: "#0A66D6" } : l)));
                  }}
                />
              </Upload>
              <div className="flex flex-col gap-4">
                <Field title="Company name">
                  <input name="brand_name" required defaultValue={prefill?.brandName} maxLength={BRAND_NAME_MAX} placeholder="e.g. SeloraX" className={input} />
                </Field>
                <div className="flex flex-col gap-1.5">
                  <span className={label}>Brand colour</span>
                  <span className="flex items-center gap-2.5 rounded-xl bg-white/60 px-3.5 py-2.5 text-sm text-foreground/60 ring-1 ring-black/[0.06]">
                    <span className="size-5 rounded-md ring-1 ring-black/10" style={{ background: logo?.colour ?? "#e6e8ec" }} />
                    {logo?.colour ? `${logo.colour} · from your icon` : "Taken from your icon"}
                  </span>
                </div>
              </div>
            </div>
          </Step>

          <div className="mt-4 flex flex-col gap-1.5 px-1">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Now, make it unmistakably yours.</h2>
            <p className="text-foreground/60">Five quick answers. Your director uses every one.</p>
          </div>

          <Step n={3} title="Your business">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field title="Type of business">
                <select name="category" required defaultValue="" className={input}>
                  <option value="" disabled>
                    Choose one
                  </option>
                  {BRAND_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABEL(c)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field title="Who it's for">
                <input name="target_audience" required maxLength={AUDIENCE_MAX} placeholder="e.g. Owners of small clinics" className={input} />
              </Field>
            </div>
          </Step>

          <Step n={4} title="What your customers used before" sub="The old way the video starts from. Choose all that apply.">
            <div id="before" className="flex flex-wrap gap-2">
              {OLD_WAYS.map((o) => (
                <label key={o} className="cursor-pointer">
                  <input
                    type="checkbox"
                    name="before"
                    value={o}
                    className="peer sr-only"
                    checked={before.includes(o)}
                    onChange={(e) => setBefore((b) => (e.target.checked ? [...b, o] : b.filter((x) => x !== o)))}
                  />
                  <span className="block rounded-full border border-foreground/12 bg-white/70 px-3.5 py-1.5 text-sm hover:border-foreground/30 peer-checked:border-[#0a66d6] peer-checked:bg-[#0a66d6]/10 peer-checked:font-medium peer-checked:text-[#0a66d6] peer-focus-visible:ring-4 peer-focus-visible:ring-[#0a66d6]/25">{o}</span>
                </label>
              ))}
            </div>
          </Step>

          <Step n={5} title="Mood">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {MOOD_CHOICES.map((m) => (
                <label key={m.mood} className="cursor-pointer">
                  <input type="radio" name="mood" value={m.mood} required className="peer sr-only" />
                  <span className="flex h-full flex-col gap-1 rounded-2xl border border-foreground/12 bg-white/70 p-3 hover:border-foreground/30 peer-checked:border-[#0a66d6] peer-checked:ring-4 peer-checked:ring-[#0a66d6]/15 peer-focus-visible:ring-4 peer-focus-visible:ring-[#0a66d6]/25">
                    <span className="text-sm font-semibold">{m.label}</span>
                    <span className="text-[11px] text-foreground/55">{m.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </Step>

          <Step n={6} title="Where the video will be used">
            <Chips name="use" options={USES} format={(u) => USE_LABEL[u]} />
          </Step>

          <Step n={7} title="Voice">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field title="Language">
                <select name="voice_language" required className={input}>
                  {VOICE_LANGUAGES.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </Field>
              <fieldset className="flex flex-col gap-2">
                <legend className={`${label} mb-2`}>Voice</legend>
                <Chips name="voice_gender" options={VOICE_GENDERS} defaultValue={VOICE_GENDERS[0]} format={(g) => (g === "male" ? "Male" : "Female")} />
              </fieldset>
              {voices.length > 0 && (
                <Field title="Voice character">
                  <select name="voice_name" defaultValue={voices.some((v) => v.name === prefill?.voice) ? prefill?.voice : ""} className={input}>
                    <option value="">Default for the voice above</option>
                    {(["female", "male"] as const).filter((g) => voices.some((v) => v.gender === g)).map((g) => (
                      <optgroup key={g} label={g === "female" ? "Female" : "Male"}>
                        {voices.filter((v) => v.gender === g).map((v) => (
                          <option key={v.name} value={v.name}>
                            {v.name}
                            {v.label ? ` — ${v.label}` : ""}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </Field>
              )}
            </div>
          </Step>

          <Step n={8} title="Format">
            <fieldset className="flex flex-col gap-2">
              <legend className="sr-only">Format</legend>
              <div className="grid grid-cols-3 gap-3">
                {FORMATS.map((f) => {
                  const [w, h] = f.split(":").map(Number);
                  return (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFormat(f)}
                      aria-pressed={format === f}
                      className={`flex flex-col items-center gap-2 rounded-2xl border bg-white/70 p-3 ${format === f ? "border-[#0a66d6] ring-4 ring-[#0a66d6]/15" : "border-foreground/12 hover:border-foreground/30"}`}
                    >
                      <span className="flex h-12 items-center justify-center">
                        <span className={`rounded-md border-2 ${format === f ? "border-[#0a66d6]" : "border-foreground/30"}`} style={{ width: (w / Math.max(w, h)) * 44, height: (h / Math.max(w, h)) * 44 }} />
                      </span>
                      <span className="text-sm font-medium">{f}</span>
                      <span className="text-[11px] text-foreground/50">{f === "16:9" ? "Web, YouTube" : f === "9:16" ? "Reels, TikTok" : "Feed"}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </Step>

          <Step n={9} title="The ending" sub="Shown on the last scene, under your icon.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field title="Call to action">
                <input name="call_to_action" required defaultValue={prefill?.cta} maxLength={CTA_MAX} placeholder="e.g. Start your free trial" className={input} />
              </Field>
              <Field title="Website">
                <input name="website_url" required defaultValue={prefill?.websiteUrl} type="url" inputMode="url" placeholder="https://yourproduct.com" className={input} />
              </Field>
            </div>
          </Step>

          {levels.length > 1 && (
            <Step n={10} title="Quality" sub="The same video, directed with more care.">
              <div className="grid gap-3 sm:grid-cols-3">
                {levels.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    disabled={l.soon || l.locked}
                    onClick={() => setQuality(l.id)}
                    aria-pressed={quality === l.id}
                    className={`relative flex flex-col items-start gap-1 rounded-2xl border bg-white/70 p-4 text-left disabled:cursor-not-allowed disabled:opacity-60 ${quality === l.id ? "border-[#0a66d6] ring-4 ring-[#0a66d6]/15" : "border-foreground/12 hover:border-foreground/30"}`}
                  >
                    <span className="flex w-full items-center justify-between gap-2">
                      <span className="text-base font-semibold">{l.name}</span>
                      {l.soon ? (
                        <span className="rounded-full bg-foreground/[0.07] px-2 py-0.5 text-[11px] font-medium text-foreground/60">Coming soon</span>
                      ) : (
                        l.badge && <span className="rounded-full bg-gradient-to-r from-[#0a66d6] to-[#7c3aed] px-2 py-0.5 text-[11px] font-semibold text-white">{l.badge}</span>
                      )}
                    </span>
                    <span className="text-xs text-foreground/60">{l.blurb}</span>
                    {l.locked && !l.soon && <span className="mt-1 text-[11px] font-medium text-[#0a66d6]">Buy credits to unlock</span>}
                  </button>
                ))}
              </div>
            </Step>
          )}

          {error && <p className="rounded-xl bg-[#fdecea] px-4 py-3 text-sm text-[#a1281b]">{error}</p>}
        </div>

        {/* Summary: a sticky side card on desktop; the button at the end on mobile. */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 flex flex-col gap-4 rounded-2xl bg-white/70 p-5 ring-1 ring-black/[0.06]">
            <span className="flex aspect-video items-center justify-center rounded-xl" style={{ background: logo?.colour ?? "#1d1d1f" }}>
              <span className="rounded-md border-2 border-white/80" style={{ width: (Number(format.split(":")[0]) / Math.max(...format.split(":").map(Number))) * 56, height: (Number(format.split(":")[1]) / Math.max(...format.split(":").map(Number))) * 56 }} />
            </span>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Summary k="Length" v={seconds ? `≈ ${seconds} s` : "—"} />
              <Summary k="Format" v={format} />
              {level && <Summary k="Quality" v={level.name} />}
            </dl>
            {submit}
            {balance}
            <p className="text-center text-[11px] text-foreground/45">1080p · download as MP4</p>
          </div>
        </aside>
        <div className="flex flex-col gap-2 lg:hidden">
          {submit}
          {balance}
        </div>
      </form>
    </>
  );
}

function Step({ n, title, sub, children }: { n: number; title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-white/70 p-5 ring-1 ring-black/[0.06] sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#1d1d1f] text-xs font-bold text-white">{n}</span>
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          {sub && <p className="mt-0.5 text-xs text-foreground/55">{sub}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={label}>{title}</span>
      {children}
    </label>
  );
}

function Upload({ title, text, sub, preview, children }: { title: string; text: string; sub: string; preview?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className={label}>{title}</span>
      <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-foreground/20 bg-white/60 px-3 py-4 text-center text-sm hover:border-[#0a66d6]/60 hover:bg-white">
        {preview ?? <span className="flex size-9 items-center justify-center rounded-full bg-[#0a66d6]/10 text-lg text-[#0a66d6]">↑</span>}
        <span className="max-w-full truncate font-medium text-foreground/80">{text}</span>
        <span className="max-w-full truncate text-[11px] text-foreground/45">{sub}</span>
        {children}
      </label>
    </div>
  );
}

// Pill radios (one required).
function Chips<T extends string>({ name, options, defaultValue, format = String }: { name: string; options: readonly T[]; defaultValue?: T; format?: (value: T) => string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <label key={o} className="cursor-pointer">
          <input type="radio" name={name} value={o} required defaultChecked={defaultValue === o} className="peer sr-only" />
          <span className="block rounded-full border border-foreground/12 bg-white/70 px-3.5 py-1.5 text-sm hover:border-foreground/30 peer-checked:border-[#0a66d6] peer-checked:bg-[#0a66d6]/10 peer-checked:font-medium peer-checked:text-[#0a66d6] peer-focus-visible:ring-4 peer-focus-visible:ring-[#0a66d6]/25">{format(o)}</span>
        </label>
      ))}
    </div>
  );
}

function Summary({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-foreground/45">{k}</dt>
      <dd className="truncate font-medium">{v}</dd>
    </div>
  );
}
