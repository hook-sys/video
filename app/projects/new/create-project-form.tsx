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
  MOTION_LEVELS,
  SCREENSHOT_MAX_BYTES,
  SCREENSHOT_MAX_FILES,
  VISUAL_DENSITIES,
  VISUAL_STYLES,
  VOICE_GENDERS,
  VOICE_LANGUAGES,
  VOICE_STYLES,
  validateLogo,
  validateScreenshots,
} from "@/lib/projects";

const sectionLabel = "text-sm font-medium";
const input = "w-full rounded-xl border border-foreground/15 bg-transparent px-3 py-2.5 text-sm transition placeholder:text-foreground/40 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20";
const select =
  "w-full rounded-xl border border-foreground/15 bg-transparent px-3 py-2.5 text-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20";

// The visual style travels with the script in the direction text.
const styleSuffix = (style: string) => `\n\nVisual style: ${style}`;
// The video lasts as long as the voice reads this script (no duration to pick).
const SCRIPT_MAX = VOICE_SCRIPT_MAX;

export function CreateProjectForm({ maxTotalBytes, waiting }: { maxTotalBytes?: number; waiting: { plan: FlowPlan; captions: HeroCaption[] } }) {
  const [state, action, pending] = useActionState(createProject, {});
  const [script, setScript] = useState("");
  const [style, setStyle] = useState<string>(VISUAL_STYLES[0]);
  const [logo, setLogo] = useState<{ name: string; url: string; size: number } | null>(null);
  const [logoError, setLogoError] = useState<string>();
  const [shots, setShots] = useState<{ names: string[]; size: number }>({ names: [], size: 0 });
  const [shotError, setShotError] = useState<string>();
  const [videoDirection, setVideoDirection] = useState("");
  const [useBrandColor, setUseBrandColor] = useState(false);
  const [brandColor, setBrandColor] = useState("#0E9CA6");
  // The logo and screenshots share the upload budget on this server.
  const budgetError =
    maxTotalBytes && (logo?.size ?? 0) + shots.size > maxTotalBytes
      ? `Logo and screenshots must total ${Math.floor(maxTotalBytes / 1024 / 1024)} MB or less.`
      : undefined;
  const error = logoError ?? shotError ?? budgetError ?? state.error;

  return (
    <>
      {pending && <WaitingScreen plan={waiting.plan} captions={waiting.captions} />}
      <form action={action} className={`flex flex-col gap-8 ${pending ? "hidden" : ""}`}>
        <input type="hidden" name="direction" value={script.trim() ? `${script.trim()}${styleSuffix(style)}` : ""} />

        <label className="flex flex-col gap-2">
          <span className={sectionLabel}>
            Voiceover script <span className="text-red-500">*</span>
          </span>
          <span className="text-xs text-foreground/50">Exactly what the voice will say. The video lasts as long as the voice (about 15 s per 250 characters).</span>
          <textarea
            required
            rows={7}
            maxLength={SCRIPT_MAX}
            value={script}
            onChange={(e) => setScript(e.target.value)}
            placeholder="e.g. Running an online store means juggling orders, stock and couriers. SeloraX brings it all into one dashboard…"
            className="w-full resize-y rounded-2xl border border-foreground/15 bg-foreground/[0.02] p-4 text-base leading-relaxed shadow-sm transition placeholder:text-foreground/40 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/15"
          />
          <span className="self-end text-xs text-foreground/50">
            {script.length}/{SCRIPT_MAX}
          </span>
        </label>

        <label className="flex flex-col gap-2">
          <span className={sectionLabel}>
            Video direction <span className="text-red-500">*</span>
          </span>
          <span className="text-xs text-foreground/50">
            What should the viewer see? Describe the scenes in order: the main object, what changes, what appears on each line, the
            mood and the ending.
          </span>
          <textarea
            name="advanced_direction"
            required
            rows={6}
            minLength={VIDEO_DIRECTION_MIN}
            maxLength={ADVANCED_DIRECTION_MAX}
            value={videoDirection}
            onChange={(e) => setVideoDirection(e.target.value)}
            placeholder="e.g. Open on our dashboard in 3D. Orders, stock and couriers fly in as icons and circle the store. On “one dashboard” everything snaps into place. Show the benefits as a checklist. Clean, calm, teal. End on our logo."
            className="w-full resize-y rounded-2xl border border-foreground/15 bg-foreground/[0.02] p-4 text-base leading-relaxed shadow-sm transition placeholder:text-foreground/40 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/15"
          />
          <span className="self-end text-xs text-foreground/50">
            {videoDirection.length}/{ADVANCED_DIRECTION_MAX}
          </span>
        </label>

        <div className="grid gap-8 sm:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className={sectionLabel}>
              Brand name <span className="font-normal text-foreground/50">(optional)</span>
            </span>
            <input name="brand_name" maxLength={BRAND_NAME_MAX} placeholder="e.g. SeloraX" className={input} />
          </label>
          <label className="flex flex-col gap-2">
            <span className={sectionLabel}>
              Call to action <span className="font-normal text-foreground/50">(optional)</span>
            </span>
            <input name="call_to_action" maxLength={CTA_MAX} placeholder="e.g. Start your free trial" className={input} />
          </label>
        </div>

        <div className="grid gap-8 sm:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className={sectionLabel}>
              Who is it for? <span className="font-normal text-foreground/50">(optional)</span>
            </span>
            <input name="target_audience" maxLength={AUDIENCE_MAX} placeholder="e.g. Small online shop owners" className={input} />
          </label>
          <div className="flex flex-col gap-2">
            <span className={sectionLabel}>
              Brand colour <span className="font-normal text-foreground/50">(optional)</span>
            </span>
            <div className="flex items-center gap-3 rounded-xl border border-foreground/15 px-3 py-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={useBrandColor} onChange={(e) => setUseBrandColor(e.target.checked)} />
                Use my colour
              </label>
              <input
                type="color"
                aria-label="Brand colour"
                value={brandColor}
                disabled={!useBrandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                className="ml-auto h-8 w-14 cursor-pointer rounded border-0 bg-transparent disabled:opacity-30"
              />
              <input type="hidden" name="brand_color" value={useBrandColor ? brandColor : ""} />
            </div>
          </div>
        </div>

        <Choice name="visual_style" title="Visual Style" options={VISUAL_STYLES} value={style} onChange={setStyle} />
        <Choice
          name="creative_direction"
          title="Creative Direction"
          options={CREATIVE_DIRECTIONS}
          defaultValue={CREATIVE_DEFAULTS.creative_direction}
        />

        <div className="grid gap-8 sm:grid-cols-2">
          <Choice name="motion_level" title="Motion" options={MOTION_LEVELS} defaultValue={CREATIVE_DEFAULTS.motion_level} columns={2} />
          <Choice
            name="visual_density"
            title="Visual Density"
            options={VISUAL_DENSITIES}
            defaultValue={CREATIVE_DEFAULTS.visual_density}
            columns={3}
          />
        </div>

        <div className="grid gap-8 sm:grid-cols-2">
          <Choice name="format" title="Format" options={FORMATS} defaultValue={FORMATS[0]} columns={3} />
        </div>

        <div className="grid gap-8 sm:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className={sectionLabel}>Voice</span>
            <select name="voice_language" required className={select}>
              {VOICE_LANGUAGES.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
          <Choice
            name="voice_gender"
            title="Voice gender"
            options={VOICE_GENDERS}
            defaultValue={VOICE_GENDERS[0]}
            format={(g) => (g === "male" ? "Male" : "Female")}
            columns={2}
          />
        </div>
        {/* Voice style isn't offered to customers; keep the existing default. */}
        <input type="hidden" name="voice_style" value={VOICE_STYLES[0]} />

        <div className="grid gap-8 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <span className={sectionLabel}>
              Logo <span className="text-red-500">*</span>
            </span>
            <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-foreground/20 px-3 py-4 text-center text-sm text-foreground/70 transition hover:border-indigo-500/60 hover:bg-indigo-500/5">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo.url} alt="" className="max-h-14 max-w-[80%] object-contain" />
              ) : (
                <span>Upload your logo</span>
              )}
              <span className="text-xs text-foreground/50">{logo ? logo.name : `PNG, JPG or WebP, up to ${LOGO_MAX_BYTES / 1024 / 1024} MB`}</span>
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
            </label>
            <span className="text-xs text-foreground/50">Shown at the end of your video. A transparent PNG works best.</span>
          </div>

          <div className="flex flex-col gap-2">
            <span className={sectionLabel}>
              Product screenshots <span className="font-normal text-foreground/50">(optional)</span>
            </span>
            <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-foreground/20 px-3 py-4 text-center text-sm text-foreground/70 transition hover:border-indigo-500/60 hover:bg-indigo-500/5">
              {shots.names.length ? `${shots.names.length} selected` : "Add screenshots"}
              <span className="text-xs text-foreground/50">
                {shots.names.length ? shots.names.join(", ") : `Up to ${SCREENSHOT_MAX_FILES} images, ${SCREENSHOT_MAX_BYTES / 1024 / 1024} MB each`}
              </span>
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
            </label>
            <span className="text-xs text-foreground/50">Your app or website, shown inside the video.</span>
          </div>
        </div>

        {error && <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-600">{error}</p>}

        <button
          disabled={pending || !!logoError || !!shotError || !!budgetError}
          className="rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-indigo-600/25 transition hover:shadow-xl hover:shadow-indigo-600/30 hover:brightness-110 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/30 disabled:opacity-60"
        >
          ✦ Generate Video
        </button>
      </form>
    </>
  );
}

// Segmented radio cards.
function Choice<T extends string | number>({
  name,
  title,
  options,
  value,
  defaultValue,
  onChange,
  format = String,
  columns,
}: {
  name: string;
  title: string;
  options: readonly T[];
  value?: T;
  defaultValue?: T;
  onChange?: (value: T) => void;
  format?: (value: T) => string;
  columns?: number;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className={`${sectionLabel} mb-2`}>{title}</legend>
      <div
        className={`grid gap-2 ${columns === 3 ? "grid-cols-3" : columns === 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}
      >
        {options.map((o) => (
          <label key={o} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              value={o}
              required
              className="peer sr-only"
              {...(value !== undefined
                ? { checked: value === o, onChange: () => onChange?.(o) }
                : { defaultChecked: defaultValue === o })}
            />
            <span className="block rounded-xl border border-foreground/15 px-3 py-2.5 text-center text-sm transition hover:border-foreground/30 peer-checked:border-indigo-500 peer-checked:bg-indigo-500/10 peer-checked:font-medium peer-checked:text-indigo-600 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-500/30 dark:peer-checked:text-indigo-300">
              {format(o)}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
