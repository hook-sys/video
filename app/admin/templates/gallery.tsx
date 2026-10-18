"use client";

import { useMemo, useState } from "react";
import { Player } from "@remotion/player";
import { SimpleFilm } from "@/components/video/simple/film";
import { galleryPlan } from "@/components/video/simple/gallery";
import { GROUNDS, PACES, TEMPLATES, TYPE_PAIRS, type Theme, WAYS } from "@/components/video/simple/types";
import { Card } from "../_components/ui";

const LABEL: Record<string, string> = { statement: "Statement — hook, any beat", kinetic: "Kinetic — the words as the show", trouble: "Trouble — the problem", compare: "Compare — before → after", reveal: "Reveal — the product arrives", feature: "Feature — the UI doing it", messages: "Messages — the product talking", bento: "Bento — what it brings", stat: "Stat — a number said", chart: "Chart — it grows", steps: "Steps — how it works", cta: "The ask — always last" , screen: "Screen — the product's own pages (its website or uploaded pictures)" };
const FRAMES = { "16:9": [1920, 1080], "9:16": [1080, 1920], "1:1": [1080, 1080] } as const;
type Frame = keyof typeof FRAMES;

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
  const [frame, setFrame] = useState<Frame>("16:9");
  const [w, h] = FRAMES[frame];
  const set = <K extends keyof Theme>(k: K) => (v: Theme[K]) => setTheme((t) => ({ ...t, [k]: v }));
  const plans = useMemo(() => TEMPLATES.map((t) => ({ t, plan: galleryPlan(theme, t, [w, h]) })), [theme, w, h]);
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-col gap-3">
          <Pick label="Frame" value={frame} list={Object.keys(FRAMES) as Frame[]} set={setFrame} />
          <Pick label="Ground" value={theme.ground} list={GROUNDS} set={set("ground")} />
          <Pick label="Type" value={theme.type} list={TYPE_PAIRS.map((_, i) => i)} show={(i) => TYPE_PAIRS[i][0]} set={set("type")} />
          <Pick label="Between" value={theme.way} list={WAYS} set={set("way")} />
          <Pick label="Pace" value={theme.pace} list={PACES} set={set("pace")} />
        </div>
      </Card>
      <div className={`grid gap-4 ${frame === "16:9" ? "lg:grid-cols-2" : "md:grid-cols-2 xl:grid-cols-3"}`}>
        {plans.map(({ t, plan }) => (
          <Card key={t} title={LABEL[t] ?? t}>
            <p className="mb-2 text-xs text-zinc-500">Variants A, B and C (3 s each)</p>
            <div className="overflow-hidden rounded-xl ring-1 ring-white/10">
              <Player key={frame} component={SimpleFilm} inputProps={{ plan }} durationInFrames={plan.duration} fps={30} compositionWidth={w} compositionHeight={h} controls loop autoPlay style={{ width: "100%", maxHeight: "70vh", aspectRatio: `${w} / ${h}` }} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
