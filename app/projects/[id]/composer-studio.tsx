"use client";

import { useRef, useState, useTransition } from "react";
import { Player } from "@remotion/player";
import { changeComposerVideo } from "@/app/projects/actions";
import { ComposerFilm } from "@/components/video/composer/film";
import { CHANGE_WORDS, COMPOSER_CHANGES, type ComposerPlan, type ComposerProps } from "@/components/video/composer/types";

// The Composer's video of a project (each scene composed by its Director):
// watch it, download it (rendered in this browser), or "Change it" with your
// own direction — each change is a new version, the earlier ones are kept.
const W = 1920;
const H = 1080;
type Props = ComposerProps & { screens?: string[] };

async function renderToFile({ props, file, signal, onProgress }: { props: Props; file: string; signal: AbortSignal; onProgress: (p: number) => void }) {
  const { renderMediaOnWeb, canRenderMediaOnWeb, getEncodableVideoCodecs } = await import("@remotion/web-renderer");
  const codecs = await getEncodableVideoCodecs("mp4");
  const videoCodec = (["h264", "vp9", "av1"] as const).find((c) => codecs.includes(c));
  if (!videoCodec) throw new Error("This browser can't encode MP4 video. Try Chrome on a computer.");
  const check = await canRenderMediaOnWeb({ width: W, height: H, container: "mp4", videoCodec });
  if (!check.canRender) throw new Error(check.issues.map((i) => i.message).join(" ") || "This browser can't render video.");
  const inputProps: Props = { ...props, webAudio: true };
  const { getBlob } = await renderMediaOnWeb({
    composition: { component: ComposerFilm, id: "ComposerFilm", width: W, height: H, fps: 30, durationInFrames: Math.max(1, props.plan.duration), defaultProps: inputProps },
    inputProps,
    container: "mp4",
    videoCodec,
    videoBitrate: "high",
    licenseKey: "free-license",
    signal,
    onProgress: (p) => onProgress(p.progress),
  });
  const url = URL.createObjectURL(await getBlob());
  const a = document.createElement("a");
  a.href = url;
  a.download = file;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// Quick directions (added to the box; the customer can edit them).
const QUICK = [
  ["Darker", "Make it darker and more premium: a deep, calm, dark background with the brand colour as the accent."],
  ["Brighter", "Make it brighter and lighter: a clean, light background with soft colours."],
  ["Calmer", "Make it calmer: slower, smoother motion and gentler cuts."],
  ["Bolder", "Make it bolder: bigger type, stronger colours and punchier cuts."],
  ["More product", "Show the product's screens (phone, browser, dashboard) in more scenes."],
  ["Less text", "Put fewer words on screen; let the pictures carry the scenes."],
] as const;
const wordsIn = (t: string) => t.split(/\s+/).filter(Boolean).length;

// byRule ("AI only for the voice"): nothing reads a written direction, so a
// change is a new version, staged and composed anew by rule.
export function ComposerStudio({ projectId, plans, changes, screens, audioUrl, name, className, secondaryClassName, byRule = false, about }: { projectId: string; plans: ComposerPlan[]; changes: { direction: string; at: string }[]; screens: string[]; audioUrl: string | null; name: string; className: string; secondaryClassName: string; byRule?: boolean; about?: { idea: string | null; mood: string | null; language: string | null; score: number | null; judge: string | null } }) {
  // the newest version unless the customer picks an earlier one
  const [picked, setPicked] = useState<number | null>(null);
  const selected = Math.min(picked ?? plans.length - 1, plans.length - 1);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string>();
  const [direction, setDirection] = useState("");
  const [note, setNote] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  const abort = useRef<AbortController | null>(null);
  const plan = plans[selected];
  const left = Math.max(0, COMPOSER_CHANGES - changes.length);
  const count = wordsIn(direction);

  const download = async () => {
    setError(undefined);
    const controller = new AbortController();
    abort.current = controller;
    try {
      setBusy(true);
      setProgress(0);
      const file = `${name.replace(/[^\w-]+/g, "-").toLowerCase() || "video"}${selected ? `-v${selected + 1}` : ""}.mp4`;
      await renderToFile({ props: { plan, audioUrl, screens }, file, signal: controller.signal, onProgress: setProgress });
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      abort.current = null;
    }
  };

  const change = () =>
    start(async () => {
      setNote(null);
      const r = await changeComposerVideo(projectId, direction);
      setNote(r);
      if (r.ok) {
        setDirection("");
        setPicked(null);
      }
    });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-violet-500/15 px-2.5 py-0.5 text-xs font-semibold text-violet-600 dark:text-violet-300">Composer</span>
        <span className="text-xs text-foreground/50">Every scene composed by the Director for your words.</span>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="flex min-w-0 flex-col gap-3">
          <div className="overflow-hidden rounded-3xl border border-foreground/10 bg-black shadow-2xl shadow-violet-900/20">
            <Player
              key={`${selected}:${plan.seed}`}
              component={ComposerFilm}
              inputProps={{ plan, audioUrl, screens } satisfies Props}
              durationInFrames={Math.max(1, plan.duration)}
              fps={30}
              compositionWidth={W}
              compositionHeight={H}
              controls
              style={{ width: "100%", maxHeight: "75vh", aspectRatio: `${W} / ${H}` }}
            />
          </div>
          {/* what the studio's Directors decided */}
          {about?.idea && (
            <p className="text-xs text-foreground/60">
              <span className="font-semibold text-foreground/80">Idea:</span> {about.idea}
              {about.mood && <> · {about.mood}</>}
              {about.language && <> · camera: {about.language}</>}
              {about.score != null && <> · Judge {about.score.toFixed(1)}/10{about.judge === "rule" ? " (rule)" : ""}</>}
            </p>
          )}
          {plans.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {plans.map((p, i) => (
                <button key={`${i}:${p.seed}`} type="button" onClick={() => setPicked(i)} title={i ? changes[i - 1]?.direction.slice(0, 300) : "The Director's video"} className={`flex flex-col items-start rounded-2xl border px-3 py-2 text-left transition ${i === selected ? "border-violet-500 bg-violet-500/10" : "border-foreground/10 hover:bg-foreground/5"}`}>
                  <span className="text-sm font-semibold">Version {i + 1}</span>
                  <span className="max-w-[180px] truncate text-xs text-foreground/55">{i ? changes[i - 1]?.direction ?? "" : "Original"}</span>
                </button>
              ))}
            </div>
          )}
        </section>
        <aside className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 rounded-3xl border border-foreground/10 bg-foreground/[0.02] p-5">
            <h2 className="text-sm font-semibold">Download</h2>
            <button type="button" disabled={busy} onClick={download} className={className}>
              {busy ? `Rendering · ${Math.round(progress * 100)}%…` : plans.length > 1 ? `↓ Download version ${selected + 1}` : "↓ Download video"}
            </button>
            {busy && (
              <>
                <div className="h-1.5 overflow-hidden rounded-full bg-foreground/10">
                  <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
                </div>
                <button type="button" onClick={() => abort.current?.abort()} className="text-xs text-foreground/55 hover:text-foreground">
                  Cancel
                </button>
              </>
            )}
            {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
            <p className="text-xs text-foreground/50">Rendered in this browser (1080p). Keep this tab open until it finishes.</p>
          </div>
          <div className="flex flex-col gap-3 rounded-3xl border border-foreground/10 bg-foreground/[0.02] p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold">{byRule ? "Another version" : "Change it"}</h2>
              <span className="text-xs text-foreground/50">{left} of {COMPOSER_CHANGES} left</span>
            </div>
            {byRule ? (
              <>
                <p className="text-xs text-foreground/55">A new version of this video: another look and another way of telling it. Your script and voice stay the same.</p>
                <button type="button" disabled={!left || pending || busy} onClick={change} className={secondaryClassName}>
                  {pending ? "Making a new version…" : left ? "↻ New version" : "No versions left"}
                </button>
              </>
            ) : (
              <>
            <p className="text-xs text-foreground/55">Tell the Director what to change — colours, mood, pace, any scene, what to show. Your script and voice stay the same.</p>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK.map(([label, line]) => (
                    <button key={label} type="button" disabled={!left || pending} onClick={() => setDirection((d) => (d.trim() ? `${d.trim()}\n${line}` : line))} className="rounded-full border border-foreground/10 px-2.5 py-1 text-xs hover:bg-foreground/5 disabled:opacity-40">
                      {label}
                    </button>
                  ))}
                </div>
                <textarea value={direction} onChange={(e) => setDirection(e.target.value)} disabled={!left || pending} rows={6} placeholder={'e.g. "Make the opening darker and more dramatic. In the scene about reminders show a phone with the notification. Use blue instead of purple."'} className="w-full resize-y rounded-xl border border-foreground/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-violet-500 disabled:opacity-50" />
                <div className="flex items-center justify-between text-xs">
                  <span className={count > CHANGE_WORDS ? "text-rose-600 dark:text-rose-400" : "text-foreground/50"}>
                    {count} / {CHANGE_WORDS} words
                  </span>
                </div>
                <button type="button" disabled={!left || pending || !count || count > CHANGE_WORDS || busy} onClick={change} className={secondaryClassName}>
                  {pending ? "Changing your video…" : left ? "✎ Change it" : "No changes left"}
                </button>
              </>
            )}
            {note && <p className={`text-xs ${note.ok ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>{note.message}</p>}
          </div>
        </aside>
      </div>
    </div>
  );
}
