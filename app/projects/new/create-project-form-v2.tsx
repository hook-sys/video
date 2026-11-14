"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { createProjectV2 } from "@/app/projects/v2-actions";
import { WaitingScreen } from "@/components/waiting/waiting-screen";
import { BRAND_NAME_MAX, FORMATS, LOGO_MAX_BYTES, SCREENS_MAX, VERCEL_SCREENSHOT_TOTAL_BYTES, VOICE_LANGUAGES, VOICE_SCRIPT_MAX, VOICE_STYLES, estimateVideoSeconds, validateLogo, voiceVideoSeconds } from "@/lib/projects";
import { V2_VOICE_TYPES } from "@/lib/v2/form";
import { Field, Step, Upload, VoicePicker, colourOf, smaller, type Prefill } from "./form-parts";

export type KitOption = { id: string; name: string; color: string | null; logoUrl: string | null; websiteUrl: string | null; isDefault: boolean };

const input =
  "w-full rounded-xl border border-foreground/12 bg-white/80 px-3.5 py-2.5 text-sm placeholder:text-foreground/35 focus:border-[#0a66d6] focus:outline-none focus:ring-4 focus:ring-[#0a66d6]/15";
const area =
  "w-full resize-y rounded-2xl border border-foreground/12 bg-white/80 p-4 text-base leading-relaxed placeholder:text-foreground/35 focus:border-[#0a66d6] focus:outline-none focus:ring-4 focus:ring-[#0a66d6]/15";
const hint = "text-xs text-foreground/50";
type VoiceOption = { name: string; gender: "female" | "male"; label: string };

// The audio's length, read by the browser (the server settles the credits
// to what Whisper hears).
function secondsOf(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const a = new Audio();
    a.preload = "metadata";
    a.onloadedmetadata = () => (URL.revokeObjectURL(url), resolve(Number.isFinite(a.duration) ? a.duration : 0));
    a.onerror = () => (URL.revokeObjectURL(url), resolve(0));
    a.src = url;
  });
}

// A new video: the script or the customer's own recording, the logo, the
// name, the website (pictures of the product are taken from it) or pictures
// of it uploaded, the voice and the format. No call to action (the button
// says the ask the voice ends on), no questions, one quality level.
// trial: the free trial's videos left and how long each may be (a customer who hasn't loaded credits)
export function CreateProjectFormV2({ prefill, voices = [], credits = null, scriptMax = VOICE_SCRIPT_MAX, kits = [], trial = null }: { prefill?: Prefill; voices?: VoiceOption[]; credits?: number | null; scriptMax?: number; kits?: KitOption[]; trial?: { left: number; of: number; seconds: number } | null }) {
  // a saved brand kit (/brand): its name, colour, website and icon, so nothing is uploaded again
  const first = prefill ? undefined : (kits.find((k) => k.isDefault) ?? kits[0]);
  const [kitId, setKitId] = useState(first?.id ?? "");
  const kit = kits.find((k) => k.id === kitId);
  const [brandName, setBrandName] = useState(first?.name ?? prefill?.brandName ?? "");
  const [website, setWebsite] = useState(first?.websiteUrl ?? prefill?.websiteUrl ?? "");
  const pick = (k?: KitOption) => {
    setKitId(k?.id ?? "");
    setBrandName(k?.name ?? "");
    setWebsite(k?.websiteUrl ?? "");
  };
  const [state, action, pending] = useActionState(createProjectV2, {});
  const [mode, setMode] = useState<"script" | "upload">("script");
  const [script, setScript] = useState(prefill?.script ?? "");
  const [uploadScript, setUploadScript] = useState("");
  const [voiceFile, setVoiceFile] = useState<{ name: string; size: number; seconds: number } | null>(null);
  const [voiceError, setVoiceError] = useState<string>();
  const [format, setFormat] = useState<string>(FORMATS[0]);
  const [logo, setLogo] = useState<{ name: string; size: number; url: string; colour: string | null } | null>(null);
  const [logoError, setLogoError] = useState<string>();
  const [screens, setScreens] = useState<File[]>([]);
  const [screensError, setScreensError] = useState<string>();
  const screensInput = useRef<HTMLInputElement>(null);
  const sending = (mode === "upload" ? (voiceFile?.size ?? 0) : 0) + (logo?.size ?? 0) + screens.reduce((a, f) => a + f.size, 0);
  const tooBig = sending > VERCEL_SCREENSHOT_TOTAL_BYTES ? `The recording, the icon and the pictures together must be ${VERCEL_SCREENSHOT_TOTAL_BYTES / 1024 / 1024} MB or smaller.` : undefined;
  const error = logoError ?? voiceError ?? screensError ?? tooBig ?? state.error;
  const seconds = mode === "upload" ? (voiceFile?.seconds ? voiceVideoSeconds(voiceFile.seconds) : 0) : script.trim() ? estimateVideoSeconds(script) : 0;
  const blocked = pending || !!logoError || !!voiceError || !!screensError || !!tooBig;

  return (
    <>
      {pending && <WaitingScreen />}
      <form action={action} className={`flex max-w-3xl flex-col gap-5 ${pending ? "hidden" : ""}`}>
        <input type="hidden" name="voice_mode" value={mode} />
        <input type="hidden" name="voice_seconds" value={voiceFile?.seconds ? voiceFile.seconds.toFixed(2) : ""} />
        <input type="hidden" name="format" value={format} />
        <input type="hidden" name="brand_color" value={logo ? (logo.colour ?? "") : (kit?.color ?? "")} />
        <input type="hidden" name="brand_kit_id" value={kitId} />
        <input type="hidden" name="voice_style" value={VOICE_STYLES[0]} />

        <Step n={1} title={mode === "script" ? "Your script" : "Your recording"}>
          {mode === "script" ? (
            <>
              <textarea name="script" required rows={7} maxLength={scriptMax} value={script} onChange={(e) => setScript(e.target.value)} placeholder="Paste your script — exactly what the voice will say" className={area} />
              <div className="flex items-center justify-between">
                <span className={hint}>{seconds ? `≈ ${seconds} s video` : "About 15 s per 250 characters"}</span>
                <span className={`${hint} tabular-nums`}>
                  {script.length}/{scriptMax}
                </span>
              </div>
              {trial && trial.left > 0 ? (
                <p className={hint}>
                  Free trial: {trial.left} of {trial.of} videos left · up to {trial.seconds} s each · with the MotionDots watermark. <Link href="/billing" className="font-medium text-[#0a66d6] hover:underline">Load credits</Link> for longer videos without it.
                </p>
              ) : trial ? (
                <p className={hint}>
                  Your free trial videos are made. <Link href="/billing" className="font-medium text-[#0a66d6] hover:underline">Load credits</Link> to make more — without the watermark, and with edits.
                </p>
              ) : (
                scriptMax < VOICE_SCRIPT_MAX && (
                  <p className={hint}>
                    Before your first credit load: a script up to {scriptMax} characters. <Link href="/billing" className="font-medium text-[#0a66d6] hover:underline">Load credits</Link> for longer scripts.
                  </p>
                )
              )}
            </>
          ) : (
            <>
            <Upload title="Your recording" text={voiceFile ? voiceFile.name : "Upload your voice"} sub={voiceFile ? `${voiceFile.seconds ? `${voiceFile.seconds.toFixed(1)} s · ` : ""}${(voiceFile.size / 1024 / 1024).toFixed(1)} MB` : "MP3, WAV or M4A · the icon and the recording together up to 4 MB"}>
              <input
                name="voice_file"
                type="file"
                required
                accept={Object.keys(V2_VOICE_TYPES).join(",")}
                className="sr-only"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  setVoiceError(undefined);
                  if (!file) return setVoiceFile(null);
                  if (!V2_VOICE_TYPES[file.type]) {
                    setVoiceFile(null);
                    return setVoiceError(`${file.name}: the recording must be an MP3, WAV or M4A file.`);
                  }
                  setVoiceFile({ name: file.name, size: file.size, seconds: await secondsOf(file) });
                }}
              />
            </Upload>
            {/* (the recording's words, written: what the video shows, timed to the recording by its pauses) */}
            <textarea name="upload_script" required rows={6} maxLength={VOICE_SCRIPT_MAX} value={uploadScript} onChange={(e) => setUploadScript(e.target.value)} placeholder="Write the words of your recording — exactly as you say them, with । , ? where you pause" className={area} />
            </>
          )}
          <button type="button" onClick={() => setMode(mode === "script" ? "upload" : "script")} className="self-start text-xs font-medium text-[#0a66d6] hover:underline">
            {mode === "script" ? "Or upload your own voice" : "Or write a script for our voice"}
          </button>
        </Step>

        <Step n={2} title="Your brand">
          {kits.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {kits.map((k) => (
                <button key={k.id} type="button" onClick={() => pick(k)} aria-pressed={kitId === k.id} className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${kitId === k.id ? "border-[#0a66d6] bg-[#0a66d6]/10 font-medium text-[#0a66d6]" : "border-foreground/12 bg-white/70 hover:border-foreground/30"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {k.logoUrl ? <img src={k.logoUrl} alt="" className="size-5 object-contain" /> : <span className="size-3 rounded-full" style={{ background: k.color ?? "#0a66d6" }} />}
                  {k.name}
                </button>
              ))}
              <button type="button" onClick={() => pick()} aria-pressed={!kitId} className={`rounded-full border px-3 py-1.5 text-sm ${!kitId ? "border-[#0a66d6] bg-[#0a66d6]/10 font-medium text-[#0a66d6]" : "border-foreground/12 bg-white/70 hover:border-foreground/30"}`}>
                + Another brand
              </button>
            </div>
          )}
          {/* (a saved brand chosen: its name and website go with it; nothing to fill in) */}
          {kit?.logoUrl ? (
            <>
              <input type="hidden" name="brand_name" value={brandName} />
              <input type="hidden" name="website_url" value={website} />
            </>
          ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Upload
              title="Icon"
              text={logo ? logo.name : kit?.logoUrl ? "Your saved icon · tap to change" : "Upload your icon"}
              sub={`PNG, JPG or WebP · up to ${LOGO_MAX_BYTES / 1024 / 1024} MB`}
              // eslint-disable-next-line @next/next/no-img-element
              preview={logo || kit?.logoUrl ? <img src={logo?.url ?? kit!.logoUrl!} alt="" className="max-h-12 max-w-[70%] object-contain" /> : undefined}
            >
              <input
                name="logo"
                type="file"
                required={!kit?.logoUrl}
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (logo) URL.revokeObjectURL(logo.url);
                  const problem = validateLogo(file);
                  setLogoError(problem);
                  if (!file || problem) return setLogo(null);
                  const url = URL.createObjectURL(file);
                  setLogo({ name: file.name, size: file.size, url, colour: null });
                  // (a colourless icon: no colour — the video draws one from a random hue)
                  colourOf(url, "")
                    .then((colour) => setLogo((l) => (l?.url === url ? { ...l, colour } : l)))
                    .catch(() => setLogo((l) => (l?.url === url ? { ...l, colour: "" } : l)));
                }}
              />
            </Upload>
            <div className="flex flex-col gap-3">
              <Field title="Company name">
                <input name="brand_name" required value={brandName} onChange={(e) => setBrandName(e.target.value)} maxLength={BRAND_NAME_MAX} placeholder="Your company name" className={input} />
              </Field>
              {!kit && <label className="flex items-center gap-2 text-xs text-foreground/65">
                <input type="checkbox" name="save_kit" value="1" defaultChecked className="size-4 accent-[#0a66d6]" />
                Save this brand for next time
              </label>}
            </div>
          </div>
          )}
        </Step>

        {/* the rest, folded away: most videos need none of it (the voice, the size, a website, pictures) */}
        <details className="group rounded-2xl bg-white/50 ring-1 ring-black/[0.05] open:bg-white/70">
          <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-sm font-medium text-foreground/70">
            <span>More options <span className="font-normal text-foreground/45">· {format}{mode === "script" ? " · voice" : ""} · website · pictures</span></span>
            <span className="text-foreground/40 transition group-open:rotate-180">▾</span>
          </summary>
          <div className="flex flex-col gap-5 px-5 pb-5">
          <Field title="Size">
            <div className="flex gap-2">
              {FORMATS.map((f) => (
                <button key={f} type="button" onClick={() => setFormat(f)} aria-pressed={format === f} className={`rounded-full border px-3.5 py-1.5 text-sm ${format === f ? "border-[#0a66d6] bg-[#0a66d6]/10 font-medium text-[#0a66d6]" : "border-foreground/12 bg-white/70 hover:border-foreground/30"}`}>
                  {f} <span className="text-[11px] text-foreground/45">{f === "16:9" ? "YouTube" : f === "9:16" ? "Reels" : "Feed"}</span>
                </button>
              ))}
            </div>
          </Field>
          {mode === "script" && (
            <Field title="Voice">
              <VoicePicker voices={voices} initial={prefill?.voice} />
            </Field>
          )}
          {!kit?.logoUrl && (
            <Field title="Website">
              <input name="website_url" type="text" inputMode="url" value={website} onChange={(e) => setWebsite(e.target.value)} maxLength={300} placeholder="yourcompany.com" className={input} />
            </Field>
          )}
          <Upload
            title="Pictures of your product"
            text={screens.length ? `${screens.length} picture${screens.length > 1 ? "s" : ""} added` : "Add up to 3 pictures"}
            sub="Website private, or behind a login? Add screenshots of it here instead."
          >
            <input
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={async (e) => {
                setScreensError(undefined);
                const picked = [...(e.target.files ?? [])].slice(0, SCREENS_MAX);
                try {
                  const made = await Promise.all(picked.map((f) => smaller(f)));
                  setScreens(made);
                  // (the smaller pictures are what the form sends)
                  const sent = new DataTransfer();
                  made.forEach((f) => sent.items.add(f));
                  if (screensInput.current) screensInput.current.files = sent.files;
                } catch (err) {
                  setScreens([]);
                  setScreensError(err instanceof Error ? err.message : "A picture could not be read.");
                }
              }}
            />
          </Upload>
          <input ref={screensInput} name="screens" type="file" multiple className="hidden" tabIndex={-1} aria-hidden />
          {kits.length > 0 && (
            <Link href="/brand" className="self-start text-xs font-medium text-[#0a66d6] hover:underline">
              Manage brand kits
            </Link>
          )}
          </div>
        </details>
        {mode !== "script" && (
          <>
            <input type="hidden" name="voice_language" value={VOICE_LANGUAGES[0]} />
            <input type="hidden" name="voice_gender" value="female" />
          </>
        )}

        {error && <p className="rounded-xl bg-[#fdecea] px-4 py-3 text-sm text-[#a1281b]">{error}</p>}
        <button disabled={blocked} className="w-full rounded-full bg-[#0a66d6] px-6 py-4 text-base font-semibold text-white hover:bg-[#0859bd] disabled:opacity-60">
          Create video
        </button>
        {credits !== null && (
          <p className="text-center text-[11px] text-foreground/50">
            You have {credits.toLocaleString("en-US")} credits · <Link href="/billing" className="font-medium text-[#0a66d6] hover:underline">add credits</Link>
          </p>
        )}
      </form>
    </>
  );
}
