"use client";

import { useActionState, useState } from "react";
import { createProject } from "@/app/projects/actions";
import { WaitingScreen } from "@/components/waiting/waiting-screen";
import {
  BRAND_NAME_MAX,
  CTA_MAX,
  directionFor,
  VOICE_SCRIPT_MAX,
  FORMATS,
  LOGO_MAX_BYTES,
  SCREENSHOT_MAX_BYTES,
  SCREENSHOT_MAX_FILES,
  STYLE_PRESETS,
  VOICE_GENDERS,
  VOICE_LANGUAGES,
  VOICE_STYLES,
  estimateVideoSeconds,
  validateLogo,
  validateScreenshots,
  type StylePreset,
} from "@/lib/projects";

const label = "text-sm font-medium";
const hint = "text-xs text-foreground/50";
const input =
  "w-full rounded-xl border border-foreground/12 bg-white/80 px-3.5 py-2.5 text-sm transition placeholder:text-foreground/35 focus:border-[#0a66d6] focus:outline-none focus:ring-4 focus:ring-[#0a66d6]/15";
const area =
  "w-full resize-y rounded-2xl border border-foreground/12 bg-white/80 p-4 text-base leading-relaxed transition placeholder:text-foreground/35 focus:border-[#0a66d6] focus:outline-none focus:ring-4 focus:ring-[#0a66d6]/15";

// No style to pick: every project gets four videos in four different styles.
const STYLE: StylePreset = "Auto";

export type Prefill = { script: string; brandName: string; websiteUrl: string; cta: string; voice?: string };
type VoiceOption = { name: string; gender: "female" | "male"; label: string };

export function CreateProjectForm({ maxTotalBytes, prefill, voices = [] }: { maxTotalBytes?: number; prefill?: Prefill; voices?: VoiceOption[] }) {
  const [state, action, pending] = useActionState(createProject, {});
  const [script, setScript] = useState(prefill?.script ?? "");
  const [format, setFormat] = useState<string>(FORMATS[0]);
  const [logo, setLogo] = useState<{ name: string; url: string; size: number } | null>(null);
  const [logoError, setLogoError] = useState<string>();
  const [shots, setShots] = useState<File[]>([]);
  // The icon and the screenshots share the upload budget on this server.
  const shotsError = validateScreenshots(shots, maxTotalBytes ? maxTotalBytes - (logo?.size ?? 0) : undefined);
  const budgetError = maxTotalBytes && (logo?.size ?? 0) > maxTotalBytes ? `The icon must be ${Math.floor(maxTotalBytes / 1024 / 1024)} MB or less.` : undefined;
  const error = logoError ?? budgetError ?? shotsError ?? state.error;
  const seconds = script.trim() ? estimateVideoSeconds(script) : 0;
  const ready = !!script.trim() && !!logo;
  const blocked = pending || !!logoError || !!budgetError || !!shotsError;

  const submit = (
    <button
      disabled={blocked}
      className="w-full rounded-full bg-[#0a66d6] px-6 py-4 text-base font-semibold text-white hover:bg-[#0859bd] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#0a66d6]/30 disabled:opacity-60"
    >
      Create video
    </button>
  );

  return (
    <>
      {pending && <WaitingScreen />}
      <form action={action} className={`grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] ${pending ? "hidden" : ""}`}>
        <input type="hidden" name="direction" value={directionFor(script, STYLE)} />
        <input type="hidden" name="visual_style" value={STYLE_PRESETS[STYLE].visual_style} />
        <input type="hidden" name="format" value={format} />
        {/* Voice style isn't offered to customers; keep the existing default. */}
        <input type="hidden" name="voice_style" value={VOICE_STYLES[0]} />

        <div className="flex min-w-0 flex-col gap-5">
          <Step n={1} title="Your voice-over" sub="Exactly what the voice will say. The video lasts as long as the voice.">
            <textarea
              required
              rows={7}
              maxLength={VOICE_SCRIPT_MAX}
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder="Paste your short script… e.g. Running an online store means juggling orders, stock and couriers. SeloraX brings it all into one dashboard…"
              className={area}
            />
            <div className="flex items-center justify-between">
              <span className={hint}>{seconds ? `≈ ${seconds} s video` : "About 15 s per 250 characters"}</span>
              <span className={`${hint} tabular-nums`}>
                {script.length}/{VOICE_SCRIPT_MAX}
              </span>
            </div>
          </Step>

          <Step n={2} title="Brand" sub="Your icon and brand name reveal the product and close the video.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Upload
                title="Icon"
                required
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
                    setLogo(file ? { name: file.name, url: URL.createObjectURL(file), size: file.size } : null);
                    setLogoError(validateLogo(file));
                  }}
                />
              </Upload>
              <Field title="Brand name" optional>
                <input name="brand_name" defaultValue={prefill?.brandName} maxLength={BRAND_NAME_MAX} placeholder="e.g. SeloraX" className={input} />
              </Field>
            </div>
          </Step>

          <Step n={3} title="Product" sub="Optional. Real words and screens from your product make the cards look like it.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field title="Website" optional>
                <input name="website_url" defaultValue={prefill?.websiteUrl} type="url" inputMode="url" placeholder="https://yourproduct.com" className={input} />
              </Field>
              <Field title="Call to action" optional>
                <input name="call_to_action" defaultValue={prefill?.cta} maxLength={CTA_MAX} placeholder="e.g. Try it free today" className={input} />
              </Field>
              <div className="sm:col-span-2">
                <Upload
                  title="Screenshots"
                  text={shots.length ? `${shots.length} screenshot${shots.length > 1 ? "s" : ""} chosen` : "Upload product screenshots"}
                  sub={`Up to ${SCREENSHOT_MAX_FILES} · PNG, JPG or WebP · ${SCREENSHOT_MAX_BYTES / 1024 / 1024} MB each`}
                >
                  <input
                    name="screenshots"
                    type="file"
                    multiple
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    onChange={(e) => setShots(Array.from(e.target.files ?? []))}
                  />
                </Upload>
              </div>
            </div>
          </Step>

          <Step n={4} title="Voice">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field title="Language">
                <select name="voice_language" required className={input}>
                  {VOICE_LANGUAGES.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </Field>
              <Chips title="Voice" name="voice_gender" options={VOICE_GENDERS} defaultValue={VOICE_GENDERS[0]} format={(g) => (g === "male" ? "Male" : "Female")} />
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

          <Step n={5} title="Format">
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

          {error && <p className="rounded-xl bg-[#fdecea] px-4 py-3 text-sm text-[#a1281b]">{error}</p>}
        </div>

        {/* Summary: a sticky side card on desktop, a bottom bar on mobile. */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 flex flex-col gap-4 rounded-2xl bg-white/70 p-5 ring-1 ring-black/[0.06]">
            <span className="flex aspect-video items-center justify-center rounded-xl bg-[#1d1d1f]">
              <span className="rounded-md border-2 border-white/70" style={{ width: (Number(format.split(":")[0]) / Math.max(...format.split(":").map(Number))) * 56, height: (Number(format.split(":")[1]) / Math.max(...format.split(":").map(Number))) * 56 }} />
            </span>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Summary k="Length" v={seconds ? `≈ ${seconds} s` : "—"} />
              <Summary k="Format" v={format} />
            </dl>
            <ul className="flex flex-col gap-1.5 text-xs text-foreground/60">
              <Check ok={!!script.trim()}>Voice-over</Check>
              <Check ok={!!logo}>Icon</Check>
            </ul>
            {submit}
            <p className="text-center text-[11px] text-foreground/45">1080p · download as MP4</p>
          </div>
        </aside>
        <div className="flex flex-col gap-2 lg:hidden">
          <p className="text-center text-xs text-foreground/60">{ready ? (seconds ? `≈ ${seconds} s video` : "Ready") : `${[!script.trim() && "voice-over", !logo && "icon"].filter(Boolean).join(", ")} missing`}</p>
          {submit}
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

function Field({ title, optional, children }: { title: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={label}>
        {title} {optional && <span className="font-normal text-foreground/45">(optional)</span>}
      </span>
      {children}
    </label>
  );
}

function Upload({ title, required, text, sub, preview, children }: { title: string; required?: boolean; text: string; sub: string; preview?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className={label}>
        {title} {required ? <span className="text-red-500">*</span> : <span className="font-normal text-foreground/45">(optional)</span>}
      </span>
      <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-foreground/20 bg-white/60 px-3 py-4 text-center text-sm hover:border-[#0a66d6]/60 hover:bg-white">
        {preview ?? <span className="flex size-9 items-center justify-center rounded-full bg-[#0a66d6]/10 text-lg text-[#0a66d6]">↑</span>}
        <span className="max-w-full truncate font-medium text-foreground/80">{text}</span>
        <span className="max-w-full truncate text-[11px] text-foreground/45">{sub}</span>
        {children}
      </label>
    </div>
  );
}

// Pill radios.
function Chips<T extends string>({
  title,
  name,
  options,
  value,
  defaultValue,
  onChange,
  format = String,
}: {
  title: string;
  name: string;
  options: readonly T[];
  value?: T;
  defaultValue?: T;
  onChange?: (value: T) => void;
  format?: (value: T) => string;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className={`${label} mb-2`}>{title}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label key={o} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              value={o}
              required
              className="peer sr-only"
              {...(value !== undefined ? { checked: value === o, onChange: () => onChange?.(o) } : { defaultChecked: defaultValue === o })}
            />
            <span className="block rounded-full border border-foreground/12 bg-white/70 px-3.5 py-1.5 text-sm hover:border-foreground/30 peer-checked:border-[#0a66d6] peer-checked:bg-[#0a66d6]/10 peer-checked:font-medium peer-checked:text-[#0a66d6] peer-focus-visible:ring-4 peer-focus-visible:ring-[#0a66d6]/25">
              {format(o)}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
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

function Check({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <span className={`flex size-4 items-center justify-center rounded-full text-[10px] ${ok ? "bg-emerald-500 text-white" : "border border-foreground/25"}`}>{ok ? "✓" : ""}</span>
      <span className={ok ? "text-foreground/80" : ""}>{children}</span>
    </li>
  );
}
