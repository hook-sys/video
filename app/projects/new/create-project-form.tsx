"use client";

import { useActionState, useState } from "react";
import { createProject } from "@/app/projects/actions";
import { GenerationScreen } from "@/components/generation-screen";
import {
  ADVANCED_DIRECTION_MAX,
  CREATIVE_DEFAULTS,
  CREATIVE_DIRECTIONS,
  DIRECTION_MAX,
  DURATIONS,
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
const select =
  "w-full rounded-xl border border-foreground/15 bg-transparent px-3 py-2.5 text-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20";

// The visual style travels with the script in the direction text.
const styleSuffix = (style: string) => `\n\nVisual style: ${style}`;
const SCRIPT_MAX = DIRECTION_MAX - Math.max(...VISUAL_STYLES.map((s) => styleSuffix(s).length));

export function CreateProjectForm({ maxTotalBytes }: { maxTotalBytes?: number }) {
  const [state, action, pending] = useActionState(createProject, {});
  const [script, setScript] = useState("");
  const [style, setStyle] = useState<string>(VISUAL_STYLES[0]);
  const [logo, setLogo] = useState<{ name: string; url: string; size: number } | null>(null);
  const [logoError, setLogoError] = useState<string>();
  const [shots, setShots] = useState<{ names: string[]; size: number }>({ names: [], size: 0 });
  const [shotError, setShotError] = useState<string>();
  // The logo and screenshots share the upload budget on this server.
  const budgetError =
    maxTotalBytes && (logo?.size ?? 0) + shots.size > maxTotalBytes
      ? `Logo and screenshots must total ${Math.floor(maxTotalBytes / 1024 / 1024)} MB or less.`
      : undefined;
  const error = logoError ?? shotError ?? budgetError ?? state.error;

  return (
    <>
      {pending && <GenerationScreen />}
      <form action={action} className={`flex flex-col gap-8 ${pending ? "hidden" : ""}`}>
        <input type="hidden" name="direction" value={script.trim() ? `${script.trim()}${styleSuffix(style)}` : ""} />

        <label className="flex flex-col gap-2">
          <span className={sectionLabel}>Tell us what you want to create</span>
          <textarea
            required
            rows={7}
            maxLength={SCRIPT_MAX}
            value={script}
            onChange={(e) => setScript(e.target.value)}
            placeholder="Write your script here..."
            className="w-full resize-y rounded-2xl border border-foreground/15 bg-foreground/[0.02] p-4 text-base leading-relaxed shadow-sm transition placeholder:text-foreground/40 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/15"
          />
          <span className="self-end text-xs text-foreground/50">
            {script.length}/{SCRIPT_MAX}
          </span>
        </label>

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
          <Choice name="duration_seconds" title="Duration" options={DURATIONS} defaultValue={DURATIONS[0]} format={(d) => `${d} sec`} columns={3} />
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

        <label className="flex flex-col gap-2">
          <span className={sectionLabel}>Advanced Direction (Optional)</span>
          <textarea
            name="advanced_direction"
            rows={3}
            maxLength={ADVANCED_DIRECTION_MAX}
            placeholder="Tell the AI how you want the video to feel or look..."
            className="w-full resize-y rounded-xl border border-foreground/15 bg-transparent p-3 text-sm leading-relaxed transition placeholder:text-foreground/40 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
          <span className="text-xs text-foreground/50">
            e.g. &ldquo;Show the tasks becoming organized inside one workspace. Keep the motion dynamic and make the ending
            feel premium.&rdquo;
          </span>
        </label>

        <div className="grid gap-8 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <span className={sectionLabel}>Logo</span>
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
