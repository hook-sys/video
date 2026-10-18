"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { resetVideoEdit, saveVideoEdit } from "@/app/projects/actions";
import { ICON_NAMES, Icon, resolveIcon } from "@/components/video/icons";
import { colourProblemsOf, problemsOf } from "@/components/video/simple/check";
import { type PlanEdit, SHOWS_THINGS, type SceneEdit, TEMPLATE_NAME, TYPE_NAME, applyEdit, editOf, mostWords, sameEdit } from "@/components/video/simple/edit";
import { variantOk } from "@/components/video/simple/select";
import { GROUNDS, PACES, type SimplePlan, TEMPLATES, type TemplateId, VARIANTS, WAYS } from "@/components/video/simple/types";

// The customer's editor of a finished video (components/video/simple/edit.ts):
// the look of the whole video, then scene by scene how it is shown, its
// words, its things, its icon and its picture of the product. Every choice is
// checked before it is offered; the preview changes at once; nothing costs
// credits. Saved, the download and the server's MP4 are the edited video.

const chip = (on: boolean, off = false) =>
  `rounded-full border px-3 py-1.5 text-xs transition ${off ? "cursor-not-allowed border-foreground/8 text-foreground/30" : on ? "border-[#0a66d6] bg-[#0a66d6]/10 font-medium text-[#0a66d6]" : "border-foreground/12 bg-white/70 hover:border-foreground/30"}`;
const card = "flex flex-col gap-3 rounded-2xl bg-white/70 p-5 ring-1 ring-black/[0.06]";
const input = "w-full rounded-lg border border-foreground/12 bg-white/80 px-2.5 py-1.5 text-sm focus:border-[#0a66d6] focus:outline-none";
const GROUND_NAME = { dark: "Dark", light: "Light", brand: "Brand colour" } as const;
const WAY_NAME = { slide: "Slide", zoom: "Zoom", wipe: "Wipe" } as const;
const PACE_NAME = { calm: "Calm", lively: "Lively" } as const;
const VARIANT_NAME = ["A", "B", "C"];

export function Editor({ projectId, plan, edited, onPreview, onPick }: { projectId: string; plan: SimplePlan; edited: boolean; onPreview: (plan: SimplePlan) => void; onPick: (frame: number) => void }) {
  const router = useRouter();
  const saved = useMemo(() => editOf(plan), [plan]);
  const [edit, setEdit] = useState<PlanEdit>(saved);
  const [past, setPast] = useState<PlanEdit[]>([]);
  const [at, setAt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string }>();

  // (what is already wrong with the video as saved is not an edit's)
  const before = useMemo(() => new Set(plan.scenes.flatMap((_, i) => problemsOf(plan, i).map((x) => `${i}:${x.detail}`))), [plan]);
  const preview = useMemo(() => applyEdit(plan, edit), [plan, edit]);
  const shown = preview.plan ?? plan;
  const scene = edit.scenes[at];
  const s = shown.scenes[at];

  const change = (next: PlanEdit) => {
    const made = applyEdit(plan, next);
    if (!made.plan) return setNote({ ok: false, text: made.error });
    setPast((p) => [...p.slice(-30), edit]);
    setEdit(next);
    setNote(undefined);
    onPreview(made.plan);
  };
  const changeScene = (part: Partial<SceneEdit>) => change({ ...edit, scenes: edit.scenes.map((x, i) => (i === at ? { ...x, ...part } : x)) });
  const pick = (i: number) => {
    setAt(i);
    onPick(shown.scenes[i].from + 12);
  };

  // a look that reads (its colours checked)
  const looks = useMemo(() => Object.fromEntries(GROUNDS.map((g) => [g, !colourProblemsOf({ ...shown, theme: { ...shown.theme, ground: g } }).length])), [shown]);
  // the ways this scene can be shown that fit it (each laid out and checked)
  const ways = useMemo(() => {
    const last = at === plan.scenes.length - 1;
    const out: { t: TemplateId; v: number }[] = [];
    for (const t of TEMPLATES) {
      if (last !== (t === "cta") || (t === "screen" && !(plan.brand.screens?.length ?? 0))) continue;
      for (let v = 0; v < VARIANTS; v++) {
        if (!variantOk(t, v, scene.items.length)) continue;
        const words = scene.show ? scene.show[1] - scene.show[0] + 1 : s.words.length;
        if (words > mostWords(t, v)) continue;
        const trial = applyEdit(plan, { ...edit, scenes: edit.scenes.map((x, i) => (i === at ? { ...x, template: t, variant: v, screen: t === "screen" ? (x.screen ?? 0) : null } : x)) });
        if (!trial.plan) continue;
        if (problemsOf(trial.plan, at).some((x) => !before.has(`${at}:${x.detail}`))) continue;
        out.push({ t, v });
      }
    }
    return out;
  }, [plan, edit, at, scene, s, before]);
  const left = (preview.plan ? problemsOf(preview.plan, at) : []).filter((x) => !before.has(`${at}:${x.detail}`));
  const dirty = !sameEdit(edit, saved);

  const save = async () => {
    setBusy(true);
    const r = await saveVideoEdit(projectId, edit);
    setBusy(false);
    if (!r.ok) return setNote({ ok: false, text: r.error });
    setNote({ ok: true, text: "Saved. Your download is the edited video." });
    setPast([]);
    router.refresh();
  };
  const reset = async () => {
    if (!confirm("Go back to the video as it was made? Your edits will be lost.")) return;
    setBusy(true);
    await resetVideoEdit(projectId);
    setBusy(false);
    setPast([]);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className={card}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Look</h2>
          <span className="text-[11px] text-foreground/45">For the whole video</span>
        </div>
        <Row title="Background">
          {GROUNDS.map((g) => (
            <button key={g} type="button" disabled={!looks[g]} title={looks[g] ? undefined : "Your colour does not read on this background"} onClick={() => change({ ...edit, theme: { ...edit.theme, ground: g } })} className={chip(edit.theme.ground === g, !looks[g])}>
              {GROUND_NAME[g]}
            </button>
          ))}
        </Row>
        <Row title="Lettering">
          {TYPE_NAME.map((n, i) => (
            <button key={n} type="button" onClick={() => change({ ...edit, theme: { ...edit.theme, type: i } })} className={chip(edit.theme.type === i)}>
              {n}
            </button>
          ))}
        </Row>
        <Row title="Between scenes">
          {WAYS.map((w) => (
            <button key={w} type="button" onClick={() => change({ ...edit, theme: { ...edit.theme, way: w } })} className={chip(edit.theme.way === w)}>
              {WAY_NAME[w]}
            </button>
          ))}
        </Row>
        <Row title="Movement">
          {PACES.map((p) => (
            <button key={p} type="button" onClick={() => change({ ...edit, theme: { ...edit.theme, pace: p } })} className={chip(edit.theme.pace === p)}>
              {PACE_NAME[p]}
            </button>
          ))}
        </Row>
      </div>

      <div className={card}>
        <h2 className="text-sm font-semibold">Scenes</h2>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {shown.scenes.map((x, i) => (
            <button key={i} type="button" onClick={() => pick(i)} className={`flex w-28 shrink-0 flex-col items-start gap-0.5 rounded-xl border p-2 text-left ${i === at ? "border-[#0a66d6] bg-[#0a66d6]/5" : "border-foreground/10 bg-white/60 hover:border-foreground/25"}`}>
              <span className="text-[10px] font-semibold text-foreground/45">
                {i + 1} · {TEMPLATE_NAME[x.template]}
              </span>
              <span className="line-clamp-2 text-xs text-foreground/75">{x.words.map((w) => w.t).join(" ")}</span>
            </button>
          ))}
        </div>

        <Row title="Show it as" sub="Each one fits this scene; A, B and C are three designs of it">
          {[...new Set(ways.map((w) => w.t))].map((t) => {
            const on = scene.template === t;
            const vs = ways.filter((w) => w.t === t).map((w) => w.v);
            const use = (v: number) => changeScene({ template: t, variant: v, screen: t === "screen" ? (scene.screen ?? 0) : null });
            return (
              <span key={t} className={`inline-flex items-center rounded-full border text-xs ${on ? "border-[#0a66d6] bg-[#0a66d6]/10" : "border-foreground/12 bg-white/70"}`}>
                <button type="button" onClick={() => !on && use(vs[0])} className={`py-1.5 pl-3 ${on ? "pr-1.5 font-medium text-[#0a66d6]" : "pr-3 hover:text-foreground"}`}>
                  {TEMPLATE_NAME[t]}
                </button>
                {on &&
                  vs.map((v) => (
                    <button key={v} type="button" onClick={() => use(v)} aria-label={`Design ${VARIANT_NAME[v]}`} className={`mr-1 flex size-6 items-center justify-center rounded-full text-[11px] ${scene.variant === v ? "bg-[#0a66d6] text-white" : "text-[#0a66d6] hover:bg-[#0a66d6]/15"}`}>
                      {VARIANT_NAME[v]}
                    </button>
                  ))}
              </span>
            );
          })}
        </Row>

        {s.said?.length && scene.show ? (
          <Row title="Words on screen" sub={`Tap a word to add it (up to ${mostWords(scene.template, scene.variant)}); tap a shown word to light it up; tap the lit word at either end to take it away`}>
            {s.said.map((w, i) => {
              const [a, b] = scene.show!;
              const on = i >= a && i <= b;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    if (!on) return changeScene({ show: [Math.min(a, i), Math.max(b, i)], key: scene.key });
                    if (scene.key !== i) return changeScene({ key: i });
                    // (a lit word tapped again: taken away, from its end)
                    if (a === b) return;
                    const show: [number, number] = i === a ? [a + 1, b] : i === b ? [a, b - 1] : [a, b];
                    changeScene({ show, key: show[0] <= i && i <= show[1] ? i : null });
                  }}
                  className={`${chip(on)} ${scene.key === i ? "!border-[#0a66d6] !bg-[#0a66d6] !text-white" : ""}`}
                >
                  {w.t}
                </button>
              );
            })}
          </Row>
        ) : (
          <p className="text-xs text-foreground/45">The words on screen of this scene were set when the video was made.</p>
        )}

        {SHOWS_THINGS.includes(scene.template) && (
          <Row title="Things it shows" sub="Up to three, each 1–3 words">
            <div className="flex w-full flex-col gap-2">
              {scene.items.map((it, k) => (
                <div key={`${at}-${k}-${scene.items.length}`} className="flex items-center gap-2">
                  <IconPick value={it.icon ?? scene.icon} onChange={(icon) => changeScene({ items: scene.items.map((x, j) => (j === k ? { ...x, icon } : x)) })} />
                  <input defaultValue={it.text} maxLength={28} onBlur={(e) => e.target.value.trim() !== it.text && changeScene({ items: scene.items.map((x, j) => (j === k ? { ...x, text: e.target.value } : x)) })} className={input} />
                  <button type="button" aria-label="Remove" onClick={() => changeScene({ items: scene.items.filter((_, j) => j !== k) })} className="px-1 text-foreground/40 hover:text-[#a1281b]">
                    ✕
                  </button>
                </div>
              ))}
              {scene.items.length < 3 && (
                <button type="button" onClick={() => changeScene({ items: [...scene.items, { text: "New thing", icon: null }] })} className="self-start text-xs font-medium text-[#0a66d6] hover:underline">
                  + Add a thing
                </button>
              )}
            </div>
          </Row>
        )}

        <Row title="Icon">
          <IconPick value={scene.icon} onChange={(icon) => icon && changeScene({ icon })} />
        </Row>

        {scene.template === "screen" && (plan.brand.screens?.length ?? 0) > 1 && (
          <Row title="Picture">
            {plan.brand.screens!.map((src, k) => (
              <button key={k} type="button" onClick={() => changeScene({ screen: k })} className={`overflow-hidden rounded-lg border-2 ${scene.screen === k ? "border-[#0a66d6]" : "border-transparent"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {src ? <img src={src} alt={`Picture ${k + 1}`} className="h-12 w-20 object-cover object-top" /> : <span className="flex h-12 w-20 items-center justify-center text-xs">{k + 1}</span>}
              </button>
            ))}
          </Row>
        )}
        {left.length > 0 && <p className="text-xs text-[#a1281b]">{left[0].detail}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={!dirty || busy || !!left.length} onClick={save} className="rounded-full bg-[#0a66d6] px-5 py-2 text-sm font-semibold text-white hover:bg-[#0859bd] disabled:opacity-50">
          {busy ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          disabled={!past.length || busy}
          onClick={() => {
            const prev = past[past.length - 1];
            setPast((p) => p.slice(0, -1));
            setEdit(prev);
            const made = applyEdit(plan, prev);
            if (made.plan) onPreview(made.plan);
          }}
          className="rounded-full border border-foreground/15 px-4 py-2 text-sm hover:border-foreground/35 disabled:opacity-40"
        >
          Undo
        </button>
        {edited && (
          <button type="button" disabled={busy} onClick={reset} className="text-xs text-foreground/55 hover:text-foreground">
            Back to the video as made
          </button>
        )}
      </div>
      {note && <p className={`text-xs ${note.ok ? "text-[#1e7a3c]" : "text-[#a1281b]"}`}>{note.text}</p>}
    </div>
  );
}

function Row({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-foreground/45">{title}</span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
      {sub && <span className="text-[11px] text-foreground/40">{sub}</span>}
    </div>
  );
}

// an icon from the library: its name typed, the ones like it offered
function IconPick({ value, onChange }: { value: string; onChange: (name: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const found = useMemo(() => (q.trim() ? ICON_NAMES.filter((n) => n.includes(q.trim().toLowerCase())).slice(0, 18) : []), [q]);
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex size-9 items-center justify-center rounded-lg border border-foreground/12 bg-white/80 hover:border-foreground/30" aria-label="Choose an icon">
        {resolveIcon(value) ? <Icon name={value} size={18} color="#0a66d6" /> : <span className="text-xs text-foreground/40">?</span>}
      </button>
      {open && (
        <div className="absolute left-0 top-10 z-20 w-64 rounded-xl bg-white p-2 shadow-xl ring-1 ring-black/10">
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search icons (truck, chart…)" className={input} />
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
                className="flex size-9 items-center justify-center rounded-lg hover:bg-[#0a66d6]/10"
              >
                <Icon name={n} size={18} color="#0e1015" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
