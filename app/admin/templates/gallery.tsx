"use client";

import { useMemo, useState } from "react";
import { Player } from "@remotion/player";
import { SimpleFilm } from "@/components/video/simple/film";
import { galleryPlan } from "@/components/video/simple/gallery";
import { GROUNDS, PACES, TEMPLATES, TYPE_PAIRS, type Theme, WAYS } from "@/components/video/simple/types";
import { Card } from "../_components/ui";

const LABEL: Record<string, string> = { statement: "Statement — hook, any beat", trouble: "Trouble — the problem", reveal: "Reveal — the product arrives", feature: "Feature — the UI doing it", stat: "Stat — a number said", steps: "Steps — how it works", cta: "The ask — always last" };

function Pick<T extends string | number>({ label, value, list, show, set }: { label: string; value: T; list: readonly T[]; show?: (v: T) => string; set: (v: T) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-24 text-xs uppercase tracking-wide text-zinc-500">{label}</span>
      {list.map((v) => (
        <button key={String(v)} type="button" onClick={() => set(v)} className={`rounded-lg border px-3 py-1.5 text-xs ${v === value ? "border-[#4f8ff0] bg-[#0a66d6]/20 text-white" : "border-white/10 text-zinc-300 hover:bg-white/5"}`}>
          {show ? show(v) : String(v)}
        </button>
      ))}
    </div>
  );
}

export function TemplateGallery() {
  const [theme, setTheme] = useState<Theme>({ ground: "dark", type: 0, way: "slide", pace: "calm" });
  const set = <K extends keyof Theme>(k: K) => (v: Theme[K]) => setTheme((t) => ({ ...t, [k]: v }));
  const plans = useMemo(() => TEMPLATES.map((t) => ({ t, plan: galleryPlan(theme, t) })), [theme]);
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-col gap-3">
          <Pick label="Ground" value={theme.ground} list={GROUNDS} set={set("ground")} />
          <Pick label="Type" value={theme.type} list={TYPE_PAIRS.map((_, i) => i)} show={(i) => TYPE_PAIRS[i][0]} set={set("type")} />
          <Pick label="Between" value={theme.way} list={WAYS} set={set("way")} />
          <Pick label="Pace" value={theme.pace} list={PACES} set={set("pace")} />
        </div>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        {plans.map(({ t, plan }) => (
          <Card key={t} title={LABEL[t] ?? t}>
            <p className="mb-2 text-xs text-zinc-500">Variant A, then variant B (3 s each)</p>
            <div className="overflow-hidden rounded-xl ring-1 ring-white/10">
              <Player component={SimpleFilm} inputProps={{ plan }} durationInFrames={plan.duration} fps={30} compositionWidth={1920} compositionHeight={1080} controls loop autoPlay style={{ width: "100%", aspectRatio: "16 / 9" }} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
