"use client";

import { memo, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Player, type PlayerRef, Thumbnail } from "@remotion/player";
import { resetVideoEdit, saveVideoEdit } from "@/app/projects/actions";
import { ICON_NAMES, Icon, resolveIcon } from "@/components/video/icons";
import { colourProblemsOf, problemsOf, settledAt } from "@/components/video/simple/check";
import { OWN_GROUNDS, type PlanEdit, SHOWS_THINGS, type SceneEdit, TEMPLATE_NAME, TYPE_NAME, applyEdit, editOf, mostWords, sameEdit } from "@/components/video/simple/edit";
import { SimpleFilm } from "@/components/video/simple/film";
import { variantOk } from "@/components/video/simple/select";
import { type FilmProps, GROUNDS, type Ground, PACES, type Scene, type SimplePlan, TEMPLATES, type TemplateId, TYPE_PAIRS, VARIANTS, WAYS } from "@/components/video/simple/types";

// The customer's editor of a finished video (components/video/simple/edit.ts),
// opened over the page: the video in the middle, its scenes on a timeline
// below, and beside it the choices for the scene picked (its layout, words,
// things, icon, picture and background) or for the whole video (its style).
// Anything in the video can be clicked: its scene is picked and its choices
// come up (the templates mark what each part is, data-part). Every choice
// is checked before it is offered and shown as it will look; nothing costs
// credits. Saved, the download and the server's MP4 are the edited video.

const GROUND_NAME = { dark: "Dark", light: "Light", brand: "Brand colour", glass: "Glass" } as const;
const WAY_NAME = { slide: "Slide", zoom: "Zoom", wipe: "Wipe", blur: "Blur" } as const;
const PACE_NAME = { calm: "Calm", lively: "Lively" } as const;
const noop = () => () => {};
// a run of words cut to fit a layout: the lit word kept, never starting or ending on a little word, as long as it can be
const LITTLE = new Set(["a", "an", "and", "the", "of", "to", "in", "on", "for", "with", "or", "by", "at", "from", "is", "are", "its", "your", "our", "that", "this"]);
function shorter(said: string[], [a, b]: [number, number], key: number | null, most: number): [number, number] {
  const little = (i: number) => LITTLE.has(said[i].toLowerCase().replace(/[^\p{L}]+/gu, ""));
  for (let n = most; n >= 1; n--)
    for (let from = a; from + n - 1 <= b; from++) {
      const to = from + n - 1;
      if (key != null && (key < from || key > to)) continue;
      if (!little(from) && !little(to)) return [from, to];
    }
  const from = Math.min(Math.max(a, (key ?? a) - Math.floor((most - 1) / 2)), b - most + 1);
  return [from, from + most - 1];
}
const sizeOf = (plan: SimplePlan) => [plan.w ?? 1920, plan.h ?? 1080] as const;
// the frame a scene is best seen at: everything in and still
const frameOf = (s: Scene) => Math.max(s.from, Math.min(s.to - 2, settledAt(s)));

const option = (on: boolean, off = false) =>
  `rounded-lg border text-left transition ${off ? "cursor-not-allowed border-white/5 opacity-35" : on ? "border-[#3b8cff] ring-2 ring-[#3b8cff]/40" : "border-white/10 hover:border-white/30"}`;
const pill = (on: boolean) => `rounded-md px-3 py-1.5 text-xs font-medium transition ${on ? "bg-[#3b8cff] text-white" : "bg-white/[0.06] text-white/75 hover:bg-white/[0.12]"}`;
const field = "w-full rounded-md border border-white/10 bg-white/[0.05] px-2.5 py-1.5 text-sm text-white placeholder:text-white/30 focus:border-[#3b8cff] focus:outline-none";

export function Editor({ projectId, plan, audioUrl, edited, onClose }: { projectId: string; plan: SimplePlan; audioUrl: string | null; edited: boolean; onClose: () => void }) {
  const router = useRouter();
  // (drawn over the page, in the browser only)
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const saved = useMemo(() => editOf(plan), [plan]);
  const [edit, setEdit] = useState<PlanEdit>(saved);
  const [past, setPast] = useState<PlanEdit[]>([]);
  const [future, setFuture] = useState<PlanEdit[]>([]);
  // (the video saved anew — or put back as made — starts the edit again)
  const sig = `${plan.print}:${plan.duration}:${edited}`;
  const [base, setBase] = useState(sig);
  if (base !== sig) {
    setBase(sig);
    setEdit(saved);
    setPast([]);
    setFuture([]);
  }
  const [at, setAt] = useState(0);
  const [tab, setTab] = useState<"scene" | "style">("scene");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string }>();
  // the choices a click in the video brought up (lit for a moment)
  const [focus, setFocus] = useState<{ sec: string; item?: number; n: number } | null>(null);
  const [frame, setFrame] = useState(0);
  const player = useRef<PlayerRef>(null);
  const opening = useRef(frameOf(plan.scenes[0]));

  // (what is already wrong with the video as saved is not an edit's)
  const before = useMemo(() => new Set(plan.scenes.flatMap((_, i) => problemsOf(plan, i).map((x) => `${i}:${x.detail}`))), [plan]);
  const preview = useMemo(() => applyEdit(plan, edit), [plan, edit]);
  const shown = preview.plan ?? plan;
  const scene = edit.scenes[at];
  const s = shown.scenes[at];
  const dirty = !sameEdit(edit, saved);
  const left = (preview.plan ? problemsOf(preview.plan, at) : []).filter((x) => !before.has(`${at}:${x.detail}`));

  const seek = (f: number) => {
    player.current?.pause();
    player.current?.seekTo(f);
  };
  const pick = (i: number) => {
    setAt(i);
    setTab("scene");
    seek(frameOf(shown.scenes[i]));
  };
  const apply = (next: PlanEdit, then?: (p: SimplePlan) => void) => {
    const made = applyEdit(plan, next);
    if (!made.plan) return setNote({ ok: false, text: made.error });
    setPast((p) => [...p.slice(-40), edit]);
    setFuture([]);
    setEdit(next);
    setNote(undefined);
    then?.(made.plan);
  };
  // (a change to the scene: shown at once, the scene held still where it is all in)
  const changeScene = (part: Partial<SceneEdit>) => apply({ ...edit, scenes: edit.scenes.map((x, i) => (i === at ? { ...x, ...part } : x)) }, (p) => seek(frameOf(p.scenes[at])));
  const changeLook = (part: Partial<PlanEdit["theme"]>) => apply({ ...edit, theme: { ...edit.theme, ...part } });
  const step = (back: boolean) => {
    const from = back ? past : future;
    if (!from.length) return;
    const to = from[from.length - 1];
    (back ? setPast : setFuture)(from.slice(0, -1));
    (back ? setFuture : setPast)((x) => [...x, edit]);
    setEdit(to);
    setNote(undefined);
  };

  // the layouts this scene can take (each laid out and checked), as they look —
  // the one it has first; one that holds fewer words keeps the run around the lit word
  const ways = useMemo(() => {
    const last = at === plan.scenes.length - 1;
    const out: { t: TemplateId; v: number; show: [number, number] | null; key: number | null; plan: SimplePlan }[] = [];
    const now = applyEdit(plan, edit).plan;
    if (now) out.push({ t: scene.template, v: scene.variant, show: scene.show, key: scene.key, plan: now });
    for (const t of TEMPLATES) {
      if (last !== (t === "cta") || (t === "screen" && !(plan.brand.screens?.length ?? 0))) continue;
      for (let v = 0; v < VARIANTS; v++) {
        if ((t === scene.template && v === scene.variant) || !variantOk(t, v, scene.items.length)) continue;
        let show = scene.show, key = scene.key;
        if (show && show[1] - show[0] + 1 > mostWords(t, v)) {
          show = shorter(s.said!.map((w) => w.t), show, key, mostWords(t, v));
          if (key != null && (key < show[0] || key > show[1])) key = null;
        } else if (!show && s.words.length > mostWords(t, v)) continue;
        const trial = applyEdit(plan, { ...edit, scenes: edit.scenes.map((x, i) => (i === at ? { ...x, template: t, variant: v, show, key, screen: t === "screen" ? (x.screen ?? 0) : null } : x)) });
        if (!trial.plan) continue;
        if (problemsOf(trial.plan, at).some((x) => !before.has(`${at}:${x.detail}`))) continue;
        out.push({ t, v, show, key, plan: trial.plan });
      }
    }
    return out;
  }, [plan, edit, at, scene, s, before]);
  // the backgrounds and lettering, as they look on this scene (a background the brand colour does not read on: not offered)
  const looks = useMemo(
    () => ({
      grounds: GROUNDS.map((g) => {
        const p = applyEdit(plan, { ...edit, theme: { ...edit.theme, ground: g } }).plan;
        return { g, plan: p, ok: !!p && !colourProblemsOf(p).length };
      }),
      types: TYPE_PAIRS.map((_, i) => ({ i, plan: applyEdit(plan, { ...edit, theme: { ...edit.theme, type: i } }).plan })),
    }),
    [plan, edit],
  );

  // this scene's background: as the video's, or one of its own (at most two scenes have one)
  const own = scene.ground && scene.ground !== edit.theme.ground ? scene.ground : null;
  const sceneGrounds = useMemo(
    () =>
      ([null, ...GROUNDS.filter((g) => g !== edit.theme.ground)] as (Ground | null)[]).map((g) => {
        const trial = applyEdit(plan, { ...edit, scenes: edit.scenes.map((x, i) => (i === at ? { ...x, ground: g } : x)) });
        const why = trial.error ?? (g && colourProblemsOf({ ...shown, theme: { ...shown.theme, ground: g } }).length ? "Your brand colour does not read on this background" : undefined);
        return { g, plan: trial.plan, why };
      }),
    [plan, edit, at, shown],
  );

  // a click in the video: its scene picked, the choices for what was clicked brought up
  const choose = (e: React.MouseEvent) => {
    const el = e.target as HTMLElement;
    const box = el.closest<HTMLElement>("[data-scene]");
    if (!box) return;
    const i = Number(box.dataset.scene);
    const sc = edit.scenes[i];
    const mark = el.closest<HTMLElement>("[data-part]");
    let part = mark && box.contains(mark) ? mark.dataset.part : undefined;
    // (a thing's own words, near an icon of it)
    const thingNear = (from: HTMLElement, up: number) => {
      for (let n: HTMLElement | null = from, d = 0; n && n !== box && d <= up; n = n.parentElement, d++) {
        const t = n.querySelectorAll<HTMLElement>('[data-part="item"]');
        if (t.length === 1) return sc.items.findIndex((x) => x.text === t[0].dataset.text);
        if (t.length > 1) return -1;
      }
      return -1;
    };
    let item = -1;
    if (part === "item") item = sc.items.findIndex((x) => x.text === mark!.dataset.text);
    else if (part === "item-icon" || (!part && el.closest("svg"))) {
      item = thingNear(mark ?? el, 3);
      if (item < 0 && part === "item-icon") part = "items";
      else if (item < 0) part = "icon";
    }
    if (item >= 0) part = "item";
    if (part === "brand") return setNote({ ok: true, text: "Your logo and brand colour come from the project." });
    const sec =
      part === "text" ? "text"
      : part === "icon" ? "icon"
      : part === "item" || part === "items" ? (SHOWS_THINGS.includes(sc.template) ? "items" : "layout")
      : part === "picture" ? ((plan.brand.screens?.length ?? 0) > 1 ? "picture" : "layout")
      : "ground";
    player.current?.pause();
    setAt(i);
    setTab("scene");
    setNote(undefined);
    const n = (focus?.n ?? 0) + 1;
    setFocus({ sec, item: item >= 0 ? item : undefined, n });
    setTimeout(() => {
      document.querySelector(`[data-sec="${sec}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
      if (item >= 0) document.querySelector<HTMLInputElement>(`[data-item-input="${item}"]`)?.focus();
    }, 60);
    setTimeout(() => setFocus((f) => (f?.n === n ? null : f)), 1600);
  };
  const lit = (sec: string) => focus?.sec === sec;

  const save = async () => {
    setBusy(true);
    const r = await saveVideoEdit(projectId, edit);
    setBusy(false);
    if (!r.ok) return setNote({ ok: false, text: r.error });
    setNote({ ok: true, text: "Saved. Your download is the edited video." });
    router.refresh();
  };
  const reset = async () => {
    if (!confirm("Go back to the video as it was made? Your edits will be lost.")) return;
    setBusy(true);
    await resetVideoEdit(projectId);
    setBusy(false);
    setNote({ ok: true, text: "Back to the video as it was made." });
    router.refresh();
  };
  const close = () => {
    if (dirty && !confirm("Leave without saving? Your changes will be lost.")) return;
    onClose();
  };

  // over the page: the page still, the playhead followed, the keys an editor has
  useEffect(() => {
    const was = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = was;
    };
  }, []);
  useEffect(() => {
    const p = player.current;
    if (!p) return;
    // (opened on the first scene, all in)
    p.seekTo(opening.current);
    const on = (e: { detail: { frame: number } }) => setFrame(e.detail.frame);
    p.addEventListener("frameupdate", on);
    p.addEventListener("seeked", on);
    return () => {
      p.removeEventListener("frameupdate", on);
      p.removeEventListener("seeked", on);
    };
  }, [mounted]);
  const keys = useRef<(e: KeyboardEvent) => void>(() => {});
  const onKey = (e: KeyboardEvent) => {
    const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName));
    if (typing) return;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === "z") {
      e.preventDefault();
      step(!e.shiftKey);
    } else if (mod && e.key.toLowerCase() === "y") {
      e.preventDefault();
      step(false);
    } else if (e.key === " ") {
      e.preventDefault();
      player.current?.toggle();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      pick(Math.max(0, Math.min(shown.scenes.length - 1, at + (e.key === "ArrowLeft" ? -1 : 1))));
    } else if (e.key === "Escape") close();
  };
  useEffect(() => {
    keys.current = onKey;
  });
  useEffect(() => {
    const on = (e: KeyboardEvent) => keys.current(e);
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);

  if (!mounted) return null;
  const [W, H] = sizeOf(shown);
  const last = shown.scenes.length - 1;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#0b0d11] text-white" role="dialog" aria-modal="true" aria-label="Edit video">
      {/* (what can be clicked in the video, outlined under the pointer) */}
      <style>{`.edit-stage [data-scene]{cursor:pointer}.edit-stage [data-scene] [data-part]:hover{outline:5px solid #3b8cff;outline-offset:10px}`}</style>
      {/* the bar: back, undo and redo, where the edit is, save */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-white/[0.07] bg-[#111318] px-3 sm:px-4">
        <button type="button" onClick={close} className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-white/75 hover:bg-white/[0.07] hover:text-white">
          <Icon name="arrow-left" size={16} color="currentColor" />
          <span className="hidden sm:inline">Back to video</span>
        </button>
        <span className="mx-1 hidden h-5 w-px bg-white/10 sm:block" />
        <button type="button" title="Undo (Ctrl+Z)" disabled={!past.length} onClick={() => step(true)} className="rounded-md p-2 text-white/75 hover:bg-white/[0.07] disabled:opacity-30">
          <Icon name="undo-2" size={16} color="currentColor" />
        </button>
        <button type="button" title="Redo (Ctrl+Shift+Z)" disabled={!future.length} onClick={() => step(false)} className="rounded-md p-2 text-white/75 hover:bg-white/[0.07] disabled:opacity-30">
          <Icon name="redo-2" size={16} color="currentColor" />
        </button>
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden text-xs text-white/45 sm:inline">{busy ? "Saving…" : dirty ? "● Unsaved changes" : edited ? "Edited · saved" : "As made"}</span>
          {edited && !dirty && (
            <button type="button" disabled={busy} onClick={reset} className="text-xs text-white/55 hover:text-white">
              Restore original
            </button>
          )}
          <button type="button" disabled={!dirty || busy || !!left.length} onClick={save} className="rounded-md bg-[#3b8cff] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#2f7cf0] disabled:opacity-40">
            Save
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* the video and its timeline */}
        <div className="flex shrink-0 flex-col lg:min-w-0 lg:flex-1 lg:shrink">
          <div className="flex items-center justify-center p-3 sm:p-6 lg:min-h-0 lg:flex-1 lg:[container-type:size]">
            <div onClick={choose} className="edit-stage w-full overflow-hidden rounded-lg bg-black shadow-2xl ring-1 ring-white/10 lg:w-[min(100cqw,calc(100cqh*var(--ratio)))]" style={{ aspectRatio: `${W} / ${H}`, ["--ratio" as string]: W / H }}>
              <Player
                ref={player}
                component={SimpleFilm}
                inputProps={{ plan: shown, audioUrl } satisfies FilmProps}
                durationInFrames={Math.max(1, shown.duration)}
                fps={30}
                compositionWidth={W}
                compositionHeight={H}
                controls
                clickToPlay={false}
                numberOfSharedAudioTags={8}
                style={{ width: "100%", height: "100%" }}
              />
            </div>
          </div>
          <Timeline plan={shown} at={at} frame={frame} onPick={pick} onSeek={seek} />
        </div>

        {/* the choices: the scene picked, or the whole video */}
        <aside className="flex min-h-0 flex-1 flex-col border-white/[0.07] bg-[#111318] lg:w-[380px] lg:flex-none lg:border-l">
          <div className="flex shrink-0 gap-1 border-b border-white/[0.07] p-2">
            {(["scene", "style"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setTab(t)} className={`flex-1 rounded-md py-2 text-sm font-medium ${tab === t ? "bg-white/[0.09] text-white" : "text-white/50 hover:text-white/80"}`}>
                {t === "scene" ? `Scene ${at + 1}` : "Style"}
              </button>
            ))}
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4">
            {tab === "scene" ? (
              <>
                <Section id="layout" lit={lit("layout")} title="Layout" hint={at === last ? "The last scene is always your brand and the ask" : `${ways.length} that fit this scene`}>
                  <div className="grid grid-cols-2 gap-2">
                    {ways.map((w) => {
                      const on = scene.template === w.t && scene.variant === w.v;
                      const n = ways.filter((x) => x.t === w.t).length;
                      return (
                        <button key={`${w.t}${w.v}`} type="button" onClick={() => !on && changeScene({ template: w.t, variant: w.v, show: w.show, key: w.key, screen: w.t === "screen" ? (scene.screen ?? 0) : null })} className={`${option(on)} overflow-hidden`}>
                          <Still plan={w.plan} frame={frameOf(w.plan.scenes[at])} />
                          <span className="block truncate px-2 py-1.5 text-[11px] text-white/70">
                            {TEMPLATE_NAME[w.t]}
                            {n > 1 ? ` ${ways.filter((x) => x.t === w.t).findIndex((x) => x.v === w.v) + 1}` : ""}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </Section>

                {s.said?.length && scene.show ? (
                  <Section id="text" lit={lit("text")} title="Text" hint={`${scene.show[1] - scene.show[0] + 1} of up to ${mostWords(scene.template, scene.variant)} words`}>
                    <Words said={s.said.map((w) => w.t)} show={scene.show} lit={scene.key} onChange={(show, key) => changeScene({ show, key })} />
                    <p className="text-[11px] leading-relaxed text-white/40">Click a word to add it · click a shown word to highlight it · × takes a word off</p>
                  </Section>
                ) : (
                  <Section id="text" lit={lit("text")} title="Text">
                    <p className="text-xs text-white/45">The words of this scene were set when the video was made.</p>
                  </Section>
                )}

                {SHOWS_THINGS.includes(scene.template) && (
                  <Section id="items" lit={lit("items")} title="Items" hint="Up to 3 · each 1–3 words">
                    <div className="flex flex-col gap-2">
                      {scene.items.map((it, k) => (
                        <div key={`${at}-${k}-${scene.items.length}`} className={`flex items-center gap-2 rounded-md transition ${focus?.sec === "items" && focus.item === k ? "bg-[#3b8cff]/15" : ""}`}>
                          <IconPick value={it.icon ?? scene.icon} onChange={(icon) => changeScene({ items: scene.items.map((x, j) => (j === k ? { ...x, icon } : x)) })} />
                          <input data-item-input={k} defaultValue={it.text} maxLength={28} onBlur={(e) => e.target.value.trim() !== it.text && changeScene({ items: scene.items.map((x, j) => (j === k ? { ...x, text: e.target.value } : x)) })} className={field} />
                          <button type="button" aria-label="Remove" onClick={() => changeScene({ items: scene.items.filter((_, j) => j !== k) })} className="rounded p-1 text-white/35 hover:bg-white/[0.07] hover:text-white">
                            <Icon name="x" size={14} color="currentColor" />
                          </button>
                        </div>
                      ))}
                      {scene.items.length < 3 && (
                        <button type="button" onClick={() => changeScene({ items: [...scene.items, { text: "New item", icon: null }] })} className="flex items-center gap-1.5 self-start rounded-md px-2 py-1 text-xs font-medium text-[#6aa8ff] hover:bg-white/[0.06]">
                          <Icon name="plus" size={14} color="currentColor" /> Add item
                        </button>
                      )}
                    </div>
                  </Section>
                )}

                <Section id="icon" lit={lit("icon")} title="Icon">
                  <IconPick value={scene.icon} onChange={(icon) => icon && changeScene({ icon })} wide />
                </Section>

                {scene.template === "screen" && (plan.brand.screens?.length ?? 0) > 1 && (
                  <Section id="picture" lit={lit("picture")} title="Picture">
                    <div className="grid grid-cols-3 gap-2">
                      {plan.brand.screens!.map((src, k) => (
                        <button key={k} type="button" onClick={() => changeScene({ screen: k })} className={`${option(scene.screen === k)} overflow-hidden`}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {src ? <img src={src} alt={`Picture ${k + 1}`} className="aspect-video w-full object-cover object-top" /> : <span className="flex aspect-video items-center justify-center text-xs">{k + 1}</span>}
                        </button>
                      ))}
                    </div>
                  </Section>
                )}

                <Section id="ground" lit={lit("ground")} title="Background" hint={`This scene only · up to ${OWN_GROUNDS} scenes`}>
                  <div className="grid grid-cols-3 gap-2">
                    {sceneGrounds.map(({ g, plan: p, why }) => (
                      <button key={g ?? "video"} type="button" disabled={!!why} title={why} onClick={() => own !== g && changeScene({ ground: g })} className={`${option(own === g, !!why)} overflow-hidden`}>
                        {p && <Still plan={p} frame={frameOf(p.scenes[at])} />}
                        <span className="block truncate px-2 py-1.5 text-[11px] text-white/70">{g ? GROUND_NAME[g] : "Same as video"}</span>
                      </button>
                    ))}
                  </div>
                </Section>
              </>
            ) : (
              <>
                <Section title="Background" hint={(() => {
                  const mine = shown.scenes.map((x, i) => (x.ground && x.ground !== shown.theme.ground ? i + 1 : 0)).filter(Boolean);
                  return mine.length ? `Scene ${mine.join(" and ")} ${mine.length > 1 ? "have" : "has"} its own` : "For the whole video";
                })()}>
                  <div className="grid grid-cols-3 gap-2">
                    {looks.grounds.map(({ g, plan: p, ok }) => (
                      <button key={g} type="button" disabled={!ok} title={ok ? undefined : "Your brand colour does not read on this background"} onClick={() => edit.theme.ground !== g && changeLook({ ground: g })} className={`${option(edit.theme.ground === g, !ok)} overflow-hidden`}>
                        {p && <Still plan={p} frame={frameOf(p.scenes[at])} />}
                        <span className="block truncate px-2 py-1.5 text-[11px] text-white/70">{GROUND_NAME[g]}</span>
                      </button>
                    ))}
                  </div>
                </Section>
                <Section title="Lettering">
                  <div className="grid grid-cols-2 gap-2">
                    {looks.types.map(({ i, plan: p }) => (
                      <button key={i} type="button" onClick={() => edit.theme.type !== i && changeLook({ type: i })} className={`${option(edit.theme.type === i)} overflow-hidden`}>
                        {p && <Still plan={p} frame={frameOf(p.scenes[at])} />}
                        <span className="block truncate px-2 py-1.5 text-[11px] text-white/70">{TYPE_NAME[i]}</span>
                      </button>
                    ))}
                  </div>
                </Section>
                <Section title="Transition" hint="Between scenes">
                  <div className="flex flex-wrap gap-1.5">
                    {WAYS.map((w) => (
                      <button key={w} type="button" onClick={() => changeLook({ way: w })} className={pill(edit.theme.way === w)}>
                        {WAY_NAME[w]}
                      </button>
                    ))}
                  </div>
                </Section>
                <Section title="Movement">
                  <div className="flex flex-wrap gap-1.5">
                    {PACES.map((p) => (
                      <button key={p} type="button" onClick={() => changeLook({ pace: p })} className={pill(edit.theme.pace === p)}>
                        {PACE_NAME[p]}
                      </button>
                    ))}
                  </div>
                </Section>
              </>
            )}
          </div>

          {(note || left.length > 0) && (
            <p className={`shrink-0 border-t border-white/[0.07] px-4 py-3 text-xs ${note?.ok ? "text-[#5fd08a]" : "text-[#ff8a80]"}`}>{note?.text ?? left[0].detail}</p>
          )}
        </aside>
      </div>
    </div>,
    document.body,
  );
}

// a section of the panel
function Section({ id, lit = false, title, hint, children }: { id?: string; lit?: boolean; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section data-sec={id} className={`-m-2 flex flex-col gap-2.5 rounded-lg p-2 transition-colors duration-500 ${lit ? "bg-[#3b8cff]/[0.12] ring-1 ring-[#3b8cff]/60" : "ring-1 ring-transparent"}`}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-white/50">{title}</h3>
        {hint && <span className="truncate text-[11px] text-white/35">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

// one frame of a plan, drawn as the video draws it
const Still = memo(function Still({ plan, frame }: { plan: SimplePlan; frame: number }) {
  const [W, H] = sizeOf(plan);
  return (
    <span className="block bg-black" style={{ aspectRatio: `${W} / ${H}` }}>
      <Thumbnail component={SimpleFilm} inputProps={{ plan, audioUrl: null } satisfies FilmProps} compositionWidth={W} compositionHeight={H} frameToDisplay={frame} durationInFrames={Math.max(1, plan.duration)} fps={30} style={{ width: "100%", height: "100%" }} />
    </span>
  );
});

// the scenes as long as they are, the one picked marked, the playhead where the video is
function Timeline({ plan, at, frame, onPick, onSeek }: { plan: SimplePlan; at: number; frame: number; onPick: (i: number) => void; onSeek: (f: number) => void }) {
  const total = Math.max(1, plan.duration);
  const bar = useRef<HTMLDivElement>(null);
  const time = (f: number) => `${Math.floor(f / 30 / 60)}:${String(Math.floor(f / 30) % 60).padStart(2, "0")}`;
  return (
    <div className="shrink-0 border-t border-white/[0.07] bg-[#0e1014] px-3 pb-3 pt-2 sm:px-6">
      <div className="mb-1.5 flex justify-between text-[10px] tabular-nums text-white/40">
        <span>{time(frame)}</span>
        <span className="hidden text-white/35 sm:inline">Click anything in the video to edit it</span>
        <span>{time(total)}</span>
      </div>
      <div
        ref={bar}
        className="relative h-[64px] cursor-pointer sm:h-[72px]"
        onClick={(e) => {
          const r = bar.current!.getBoundingClientRect();
          onSeek(Math.round(((e.clientX - r.left) / r.width) * (total - 1)));
        }}
      >
        {plan.scenes.map((x, i) => (
          <button
            key={i}
            type="button"
            title={`Scene ${i + 1} · ${TEMPLATE_NAME[x.template]}`}
            onClick={(e) => {
              e.stopPropagation();
              onPick(i);
            }}
            className={`absolute inset-y-0 overflow-hidden rounded-md border-2 bg-[#1a1d24] transition ${i === at ? "z-10 border-[#3b8cff]" : "border-transparent hover:border-white/25"}`}
            style={{ left: `calc(${(x.from / total) * 100}% + 1px)`, width: `calc(${((x.to - x.from) / total) * 100}% - 2px)` }}
          >
            <span className="absolute inset-0 flex items-center opacity-85">
              <span className="w-full">
                <Still plan={plan} frame={frameOf(x)} />
              </span>
            </span>
            <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/85 to-transparent px-1.5 pb-1 pt-3 text-left text-[10px] font-medium text-white/90">
              {i + 1} · {TEMPLATE_NAME[x.template]}
            </span>
          </button>
        ))}
        <span className="pointer-events-none absolute -bottom-1 -top-1 z-20 w-0.5 rounded-full bg-white shadow-[0_0_6px_rgba(0,0,0,0.6)]" style={{ left: `${(frame / total) * 100}%` }} />
      </div>
    </div>
  );
}

// the words the voice says in the scene: those on screen marked, the lit one filled
function Words({ said, show, lit, onChange }: { said: string[]; show: [number, number]; lit: number | null; onChange: (show: [number, number], key: number | null) => void }) {
  const [a, b] = show;
  return (
    <div className="flex flex-wrap gap-1 rounded-lg bg-white/[0.03] p-2.5 ring-1 ring-white/[0.06]">
      {said.map((w, i) => {
        const on = i >= a && i <= b;
        const end = on && a !== b && (i === a || i === b);
        return (
          <span key={i} className="inline-flex">
            {end && i === a && (
              <button type="button" aria-label={`Take “${w}” off`} onClick={() => onChange([a + 1, b], lit === a ? null : lit)} className="rounded-l bg-[#3b8cff]/20 px-1 text-white/50 hover:text-white">
                ×
              </button>
            )}
            <button
              type="button"
              onClick={() => (on ? onChange(show, lit === i ? null : i) : onChange([Math.min(a, i), Math.max(b, i)], lit))}
              className={`rounded px-1.5 py-0.5 text-sm transition ${i === lit ? "bg-[#3b8cff] font-semibold text-white" : on ? "bg-[#3b8cff]/20 text-white" : "text-white/40 hover:bg-white/[0.07] hover:text-white/80"} ${end ? (i === a ? "rounded-l-none" : "rounded-r-none") : ""}`}
            >
              {w}
            </button>
            {end && i === b && (
              <button type="button" aria-label={`Take “${w}” off`} onClick={() => onChange([a, b - 1], lit === b ? null : lit)} className="rounded-r bg-[#3b8cff]/20 px-1 text-white/50 hover:text-white">
                ×
              </button>
            )}
          </span>
        );
      })}
    </div>
  );
}

// an icon from the library: its name typed, the ones like it offered
function IconPick({ value, onChange, wide = false }: { value: string; onChange: (name: string | null) => void; wide?: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const found = useMemo(() => (q.trim() ? ICON_NAMES.filter((n) => n.includes(q.trim().toLowerCase())).slice(0, 24) : []), [q]);
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className={`flex h-9 items-center gap-2 rounded-md border border-white/10 bg-white/[0.05] px-2.5 hover:border-white/30 ${wide ? "w-full" : "w-9 justify-center px-0"}`} aria-label="Choose an icon">
        {resolveIcon(value) ? <Icon name={value} size={18} color="#6aa8ff" /> : <span className="text-xs text-white/40">?</span>}
        {wide && <span className="truncate text-sm text-white/70">{value}</span>}
        {wide && <span className="ml-auto text-xs text-white/40">Change</span>}
      </button>
      {open && (
        <div className="absolute left-0 top-11 z-30 w-72 rounded-lg bg-[#1a1d24] p-2 shadow-2xl ring-1 ring-white/10">
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Escape" && setOpen(false)} placeholder="Search icons (truck, chart…)" className={field} />
          <div className="mt-2 grid grid-cols-6 gap-1">
            {found.map((n) => (
              <button
                key={n}
                type="button"
                title={n}
                onClick={() => {
                  onChange(n);
                  setOpen(false);
                  setQ("");
                }}
                className="flex size-10 items-center justify-center rounded-md hover:bg-white/[0.09]"
              >
                <Icon name={n} size={18} color="#ffffff" />
              </button>
            ))}
          </div>
          {!q.trim() && <p className="px-1 py-2 text-[11px] text-white/40">Type to find an icon.</p>}
        </div>
      )}
    </div>
  );
}
