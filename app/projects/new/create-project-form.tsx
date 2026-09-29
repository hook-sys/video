"use client";

import { useActionState, useState } from "react";
import { createProject } from "@/app/projects/actions";
import type { HeroCaption } from "@/components/landing/hero-plan";
import type { FlowPlan } from "@/components/video/flow/types";
import { WaitingScreen } from "@/components/waiting/waiting-screen";
import {
  ADVANCED_DIRECTION_MAX,
  AUDIENCE_MAX,
  BRAND_NAME_MAX,
  CTA_MAX,
  VIDEO_DIRECTION_MIN,
  CREATIVE_DEFAULTS,
  CREATIVE_DIRECTIONS,
  VOICE_SCRIPT_MAX,
  FORMATS,
  LOGO_MAX_BYTES,
  LOOKS,
  MOTION_LEVELS,
  SCREENSHOT_MAX_BYTES,
  SCREENSHOT_MAX_FILES,
  VISUAL_DENSITIES,
  VISUAL_STYLES,
  VOICE_GENDERS,
  VOICE_LANGUAGES,
  VOICE_STYLES,
  estimateVideoSeconds,
  validateLogo,
  validateScreenshots,
  type Look,
} from "@/lib/projects";

const label = "text-sm font-medium";
const hint = "text-xs text-foreground/50";
const input =
  "w-full rounded-xl border border-foreground/12 bg-background px-3.5 py-2.5 text-sm transition placeholder:text-foreground/35 focus:border-violet-500 focus:outline-none focus:ring-4 focus:ring-violet-500/15";
const area =
  "w-full resize-y rounded-2xl border border-foreground/12 bg-background p-4 text-base leading-relaxed transition placeholder:text-foreground/35 focus:border-violet-500 focus:outline-none focus:ring-4 focus:ring-violet-500/15";

// The visual style and the look travel with the script in the direction text.
const styleSuffix = (style: string, look: Look) => `\n\nVisual style: ${style}${look === "Auto" ? "" : `\nLook: ${look}`}`;

// One-tap ideas for the scene direction (appended as sentences).
const IDEAS = [
  "Open on the problem our customers feel.",
  "Show our dashboard in 3D, then zoom into the key number.",
  "A cursor clicks through the main flow.",
  "Before → after: the messy way is crossed out.",
  "Big numbers count up.",
  "Our integrations orbit the product.",
  "End on our logo and call to action.",
];

const LOOK_INFO: Record<Look, string> = {
  Auto: "We pick what fits your product",
  "Light glass": "Bright, airy, frosted glass",
  "Dark glow": "Deep, cinematic, glowing",
  "Warm brand": "Your colour carries the film",
};

export function CreateProjectForm({ maxTotalBytes, waiting }: { maxTotalBytes?: number; waiting: { plan: FlowPlan; captions: HeroCaption[] } }) {
  const [state, action, pending] = useActionState(createProject, {});
  const [script, setScript] = useState("");
  const [style, setStyle] = useState<string>(VISUAL_STYLES[0]);
  const [look, setLook] = useState<Look>("Auto");
  const [format, setFormat] = useState<string>(FORMATS[0]);
  const [logo, setLogo] = useState<{ name: string; url: string; size: number } | null>(null);
  const [logoError, setLogoError] = useState<string>();
  const [shots, setShots] = useState<{ names: string[]; size: number }>({ names: [], size: 0 });
  const [shotError, setShotError] = useState<string>();
  const [videoDirection, setVideoDirection] = useState("");
  const [useBrandColor, setUseBrandColor] = useState(false);
  const [brandColor, setBrandColor] = useState("#7C3AED");
  // What is typed in the hex box (may be incomplete while typing).
  const [hexText, setHexText] = useState("#7C3AED");
  const hexValid = /^#?[0-9a-fA-F]{6}$/.test(hexText.trim());
  // The logo and screenshots share the upload budget on this server.
  const budgetError =
    maxTotalBytes && (logo?.size ?? 0) + shots.size > maxTotalBytes
      ? `Logo and screenshots must total ${Math.floor(maxTotalBytes / 1024 / 1024)} MB or less.`
      : undefined;
  const error = logoError ?? shotError ?? budgetError ?? state.error;
  const seconds = script.trim() ? estimateVideoSeconds(script) : 0;
  const ready = !!script.trim() && videoDirection.trim().length >= VIDEO_DIRECTION_MIN && !!logo;
  const blocked = pending || !!logoError || !!shotError || !!budgetError || (useBrandColor && !hexValid);
  const accent = useBrandColor ? brandColor : "#7C3AED";

  const addIdea = (idea: string) =>
    setVideoDirection((d) => {
      const next = d.trim() ? `${d.trim()} ${idea}` : idea;
      return next.slice(0, ADVANCED_DIRECTION_MAX);
    });

  const submit = (
    <button
      disabled={blocked}
      className="w-full rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-violet-600/25 transition hover:shadow-xl hover:shadow-violet-600/35 hover:brightness-110 focus:outline-none focus-visible:ring-4 focus-visible:ring-violet-500/30 disabled:opacity-60"
    >
      ✦ Generate video
    </button>
  );

  return (
    <>
      {pending && <WaitingScreen plan={waiting.plan} captions={waiting.captions} />}
      <form action={action} className={`grid gap-6 pb-28 lg:grid-cols-[minmax(0,1fr)_300px] lg:pb-0 ${pending ? "hidden" : ""}`}>
        <input type="hidden" name="direction" value={script.trim() ? `${script.trim()}${styleSuffix(style, look)}` : ""} />
        <input type="hidden" name="visual_style" value={style} />
        <input type="hidden" name="format" value={format} />
        {/* Voice style isn't offered to customers; keep the existing default. */}
        <input type="hidden" name="voice_style" value={VOICE_STYLES[0]} />

        <div className="flex min-w-0 flex-col gap-5">
          <Step n={1} title="Your script" sub="Exactly what the voice will say. The video lasts as long as the voice.">
            <textarea
              required
              rows={6}
              maxLength={VOICE_SCRIPT_MAX}
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder="e.g. Running an online store means juggling orders, stock and couriers. SeloraX brings it all into one dashboard…"
              className={area}
            />
            <div className="flex items-center justify-between">
              <span className={hint}>{seconds ? `≈ ${seconds} s video` : "About 15 s per 250 characters"}</span>
              <span className={`${hint} tabular-nums`}>
                {script.length}/{VOICE_SCRIPT_MAX}
              </span>
            </div>
          </Step>

          <Step n={2} title="What viewers see" sub="Describe the scenes in order: the main object, what changes, the mood and the ending.">
            <textarea
              name="advanced_direction"
              required
              rows={5}
              minLength={VIDEO_DIRECTION_MIN}
              maxLength={ADVANCED_DIRECTION_MAX}
              value={videoDirection}
              onChange={(e) => setVideoDirection(e.target.value)}
              placeholder="e.g. Open on our dashboard in 3D. Orders, stock and couriers fly in and circle the store. On “one dashboard” everything snaps into place. End on our logo."
              className={area}
            />
            <div className="flex flex-col gap-2">
              <span className={hint}>Tap to add an idea</span>
              <div className="flex flex-wrap gap-2">
                {IDEAS.map((idea) => (
                  <button
                    key={idea}
                    type="button"
                    onClick={() => addIdea(idea)}
                    className="rounded-full border border-foreground/12 px-3 py-1.5 text-xs text-foreground/70 transition hover:border-violet-500/50 hover:bg-violet-500/5 hover:text-foreground"
                  >
                    + {idea.replace(/\.$/, "")}
                  </button>
                ))}
              </div>
              <span className={`${hint} self-end tabular-nums`}>
                {videoDirection.length}/{ADVANCED_DIRECTION_MAX}
              </span>
            </div>
          </Step>

          <Step n={3} title="Your brand" sub="Your logo closes the video; screenshots make it yours.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Upload
                title="Logo"
                required
                text={logo ? logo.name : "Upload your logo"}
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
              <Upload
                title="Product screenshots"
                text={shots.names.length ? `${shots.names.length} selected` : "Add screenshots"}
                sub={shots.names.length ? shots.names.join(", ") : `Up to ${SCREENSHOT_MAX_FILES} · ${SCREENSHOT_MAX_BYTES / 1024 / 1024} MB each · recommended`}
              >
                <input
                  name="screenshots"
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={(e) => {
                    const chosen = Array.from(e.target.files ?? []);
                    setShots({ names: chosen.map((f) => f.name), size: chosen.reduce((n, f) => n + f.size, 0) });
                    setShotError(validateScreenshots(chosen));
                  }}
                />
              </Upload>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field title="Brand name">
                <input name="brand_name" maxLength={BRAND_NAME_MAX} placeholder="e.g. SeloraX" className={input} />
              </Field>
              <Field title="Call to action">
                <input name="call_to_action" maxLength={CTA_MAX} placeholder="e.g. Start your free trial" className={input} />
              </Field>
              <Field title="Who is it for?">
                <input name="target_audience" maxLength={AUDIENCE_MAX} placeholder="e.g. Small online shop owners" className={input} />
              </Field>
              <div className="flex flex-col gap-1.5">
                <span className={label}>Brand colour</span>
                <div className={`flex items-center gap-2 rounded-xl border px-2 py-1.5 ${useBrandColor && !hexValid ? "border-red-500/60" : "border-foreground/12"}`}>
                  <input type="checkbox" aria-label="Use my colour" checked={useBrandColor} onChange={(e) => setUseBrandColor(e.target.checked)} className="ml-1 accent-violet-600" />
                  <input
                    type="color"
                    aria-label="Pick brand colour"
                    value={brandColor}
                    onChange={(e) => {
                      setBrandColor(e.target.value.toUpperCase());
                      setHexText(e.target.value.toUpperCase());
                      setUseBrandColor(true);
                    }}
                    className="h-8 w-10 shrink-0 cursor-pointer rounded border-0 bg-transparent"
                  />
                  <input
                    aria-label="Brand colour code"
                    value={hexText}
                    maxLength={7}
                    spellCheck={false}
                    placeholder="#7C3AED"
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      setHexText(v);
                      setUseBrandColor(true);
                      if (/^#?[0-9a-fA-F]{6}$/.test(v)) setBrandColor(`#${v.replace("#", "").toUpperCase()}`);
                    }}
                    onBlur={() => hexValid && setHexText(brandColor)}
                    className="min-w-0 flex-1 bg-transparent px-1 py-1.5 font-mono text-sm uppercase outline-none placeholder:text-foreground/35"
                  />
                  <input type="hidden" name="brand_color" value={useBrandColor ? brandColor : ""} />
                </div>
                <span className={`text-[11px] ${useBrandColor && !hexValid ? "text-red-500" : "text-foreground/45"}`}>
                  {useBrandColor && !hexValid ? "Enter a 6-digit code like #7C3AED" : "Pick a colour or type its code (e.g. #0E9CA6)"}
                </span>
              </div>
            </div>
          </Step>

          <Step n={4} title="Look & feel" sub="How the video should look and move.">
            <fieldset className="flex flex-col gap-2">
              <legend className={`${label} mb-2`}>
                Look <span className="ml-1 rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-300">New</span>
              </legend>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {LOOKS.map((l) => (
                  <label key={l} className="cursor-pointer">
                    <input type="radio" name="look" value={l} checked={look === l} onChange={() => setLook(l)} className="peer sr-only" />
                    <span className="flex h-full flex-col gap-2 rounded-2xl border border-foreground/12 p-2 transition hover:border-foreground/30 peer-checked:border-violet-500 peer-checked:ring-4 peer-checked:ring-violet-500/15 peer-focus-visible:ring-4 peer-focus-visible:ring-violet-500/30">
                      <LookPreview look={l} accent={accent} />
                      <span className="px-1 text-sm font-medium">{l}</span>
                      <span className="px-1 pb-1 text-[11px] leading-snug text-foreground/50">{LOOK_INFO[l]}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <Chips title="Visual style" name="visual_style_pick" options={VISUAL_STYLES} value={style} onChange={setStyle} />
            <Chips title="Story" name="creative_direction" options={CREATIVE_DIRECTIONS} defaultValue={CREATIVE_DEFAULTS.creative_direction} />
            <div className="grid gap-5 sm:grid-cols-2">
              <Chips title="Motion" name="motion_level" options={MOTION_LEVELS} defaultValue={CREATIVE_DEFAULTS.motion_level} />
              <Chips title="Visual density" name="visual_density" options={VISUAL_DENSITIES} defaultValue={CREATIVE_DEFAULTS.visual_density} />
            </div>
          </Step>

          <Step n={5} title="Voice & format">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field title="Voice language">
                <select name="voice_language" required className={input}>
                  {VOICE_LANGUAGES.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </Field>
              <Chips title="Voice" name="voice_gender" options={VOICE_GENDERS} defaultValue={VOICE_GENDERS[0]} format={(g) => (g === "male" ? "Male" : "Female")} />
            </div>
            <fieldset className="flex flex-col gap-2">
              <legend className={`${label} mb-2`}>Format</legend>
              <div className="grid grid-cols-3 gap-3">
                {FORMATS.map((f) => {
                  const [w, h] = f.split(":").map(Number);
                  return (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFormat(f)}
                      aria-pressed={format === f}
                      className={`flex flex-col items-center gap-2 rounded-2xl border p-3 transition ${format === f ? "border-violet-500 bg-violet-500/[0.06] ring-4 ring-violet-500/15" : "border-foreground/12 hover:border-foreground/30"}`}
                    >
                      <span className="flex h-12 items-center justify-center">
                        <span className={`rounded-md border-2 ${format === f ? "border-violet-500" : "border-foreground/30"}`} style={{ width: (w / Math.max(w, h)) * 44, height: (h / Math.max(w, h)) * 44 }} />
                      </span>
                      <span className="text-sm font-medium">{f}</span>
                      <span className="text-[11px] text-foreground/50">{f === "16:9" ? "Web, YouTube" : f === "9:16" ? "Reels, TikTok" : "Feed"}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </Step>

          {error && <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>

        {/* Summary: a sticky side card on desktop, a bottom bar on mobile. */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 flex flex-col gap-4 rounded-3xl border border-foreground/10 bg-foreground/[0.02] p-5">
            <LookPreview look={look} accent={accent} big />
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Summary k="Length" v={seconds ? `≈ ${seconds} s` : "—"} />
              <Summary k="Format" v={format} />
              <Summary k="Look" v={look} />
              <Summary k="Style" v={style} />
            </dl>
            <ul className="flex flex-col gap-1.5 text-xs text-foreground/60">
              <Check ok={!!script.trim()}>Script</Check>
              <Check ok={videoDirection.trim().length >= VIDEO_DIRECTION_MIN}>What viewers see</Check>
              <Check ok={!!logo}>Logo</Check>
            </ul>
            {submit}
            <p className="text-center text-[11px] text-foreground/45">1080p · 4K download available after</p>
          </div>
        </aside>
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-foreground/10 bg-background/90 px-4 py-3 backdrop-blur-xl lg:hidden">
          <div className="mx-auto flex max-w-2xl items-center gap-3">
            <div className="shrink-0 text-xs text-foreground/60">
              <p className="font-semibold text-foreground">{seconds ? `≈ ${seconds} s` : "New video"}</p>
              <p>{ready ? "Ready" : `${[!script.trim() && "script", videoDirection.trim().length < VIDEO_DIRECTION_MIN && "scenes", !logo && "logo"].filter(Boolean).join(", ")} missing`}</p>
            </div>
            <div className="flex-1">{submit}</div>
          </div>
        </div>
      </form>
    </>
  );
}

function Step({ n, title, sub, children }: { n: number; title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-3xl border border-foreground/10 bg-foreground/[0.02] p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-xs font-bold text-white">{n}</span>
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

function Upload({ title, required, text, sub, preview, children }: { title: string; required?: boolean; text: string; sub: string; preview?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className={label}>
        {title} {required ? <span className="text-red-500">*</span> : <span className="font-normal text-foreground/45">(optional)</span>}
      </span>
      <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-foreground/20 px-3 py-4 text-center text-sm transition hover:border-violet-500/60 hover:bg-violet-500/[0.04]">
        {preview ?? <span className="flex size-9 items-center justify-center rounded-full bg-violet-500/10 text-lg text-violet-600 dark:text-violet-300">↑</span>}
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
            <span className="block rounded-full border border-foreground/12 px-3.5 py-1.5 text-sm transition hover:border-foreground/30 peer-checked:border-violet-500 peer-checked:bg-violet-500/10 peer-checked:font-medium peer-checked:text-violet-700 peer-focus-visible:ring-4 peer-focus-visible:ring-violet-500/25 dark:peer-checked:text-violet-300">
              {format(o)}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

// A tiny picture of each look: its background, a glass screen and an accent card.
function LookPreview({ look, accent, big }: { look: Look; accent: string; big?: boolean }) {
  const bg: Record<Look, string> = {
    Auto: "linear-gradient(135deg, #e0e7ff, #f5d0fe 50%, #0f172a 50.5%, #312e81)",
    "Light glass": "radial-gradient(80% 90% at 20% 20%, #ede9fe, transparent), radial-gradient(70% 80% at 90% 90%, #cffafe, transparent), #f8fafc",
    "Dark glow": "radial-gradient(60% 70% at 70% 30%, #6d28d955, transparent), radial-gradient(120% 90% at 50% 40%, #1e1b4b, #020617)",
    "Warm brand": `radial-gradient(70% 80% at 25% 25%, ${accent}55, transparent), radial-gradient(70% 80% at 85% 85%, ${accent}33, transparent), #fff7ed`,
  };
  const dark = look === "Dark glow";
  return (
    <span className={`relative block overflow-hidden rounded-xl ${big ? "aspect-video" : "aspect-[4/3]"}`} style={{ background: bg[look] }}>
      {look === "Auto" ? (
        <span className="absolute inset-0 flex items-center justify-center text-2xl text-white drop-shadow">✦</span>
      ) : (
        <>
          <span
            className="absolute left-[12%] top-[20%] h-[52%] w-[54%] rounded-md"
            style={{ background: dark ? "rgba(255,255,255,.08)" : "rgba(255,255,255,.75)", border: `1px solid ${dark ? "rgba(255,255,255,.18)" : "#fff"}`, boxShadow: dark ? `0 0 24px ${accent}66` : "0 8px 20px rgba(80,60,200,.15)", transform: "perspective(200px) rotateY(-10deg)" }}
          >
            <span className="absolute left-[10%] top-[18%] h-[10%] w-[45%] rounded-full" style={{ background: dark ? "rgba(255,255,255,.4)" : "#c7d2fe" }} />
            <span className="absolute bottom-[14%] left-[10%] flex h-[40%] w-[80%] items-end gap-[6%]">
              {[40, 65, 50, 90].map((h, i) => (
                <span key={i} className="flex-1 rounded-sm" style={{ height: `${h}%`, background: i === 3 ? accent : dark ? "rgba(255,255,255,.25)" : "#e0e7ff" }} />
              ))}
            </span>
          </span>
          <span className="absolute bottom-[16%] right-[10%] h-[30%] w-[34%] rounded-md" style={{ background: look === "Light glass" ? "#fff" : accent, boxShadow: `0 8px 18px ${accent}55` }} />
        </>
      )}
    </span>
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
