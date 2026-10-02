import { AbsoluteFill, useCurrentFrame } from "remotion";
import { useCleanFont } from "../clean-video";
import { flowlyPlan } from "../fixtures/flowly";
import type { CleanPlan } from "../types";
import { beatsFromPlan } from "./beats";
import { BrandCtx } from "./common";
import { ConnectFilm } from "./connect";
import { DuskFilm } from "./dusk";
import { FlyFilm } from "./fly";
import { GlowFilm } from "./glow";

// The four reference-style film templates. Each takes any seven-part
// CleanPlan (its words, moments, three things and brand) and plays it in
// its own look: see ./catalog for what each one shows.
export const REF_ID = "CleanRef";
export const FILM_ID = "CleanFilm";
export const REF_DURATION = flowlyPlan(0).duration;
export const FILMS = { glow: GlowFilm, dusk: DuskFilm, fly: FlyFilm, connect: ConnectFilm } as const;
export type FilmId = keyof typeof FILMS;
export const FILM_IDS = Object.keys(FILMS) as FilmId[];

export function Film({ plan, film }: { plan: CleanPlan; film: FilmId }) {
  useCleanFont();
  const f = useCurrentFrame();
  const b = beatsFromPlan(plan);
  const F = FILMS[film] ?? GlowFilm;
  const brand = { name: plan.brand.name, icon: plan.brand.icon, tagline: plan.brand.tagline, cta: plan.brand.cta, url: plan.brand.url, things: b.trio.map((x) => ({ label: x.label, icon: x.icon })) };
  return (
    <BrandCtx.Provider value={brand}>
      <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
        <F f={f} b={b} />
      </AbsoluteFill>
    </BrandCtx.Provider>
  );
}

// Proof: the Flowly script in film 0–3.
export function RefFilm({ film }: { film: number }) {
  return <Film plan={flowlyPlan(0)} film={FILM_IDS[film] ?? "glow"} />;
}
