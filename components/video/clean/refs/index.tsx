import { AbsoluteFill, Html5Audio, useCurrentFrame } from "remotion";
import { Audio as MediaAudio } from "@remotion/media";
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

// `hue`: a turn of the whole film's colours (degrees), from the variation
// engine; the brand's uploaded icon is turned back so it keeps its colours.
// `audioUrl`: the voice; `webAudio` mixes it through @remotion/media (what
// the in-browser renderer can put into the file).
// `postHue`: the colour turn is done on the finished frames instead (the
// in-browser renderer does not apply a parent's CSS filter everywhere): the
// film is drawn unturned and only the brand icon is turned back in advance.
export type FilmProps = { plan: CleanPlan; film: FilmId; hue?: number; postHue?: number; audioUrl?: string | null; webAudio?: boolean };
export function Film({ plan, film, hue = 0, postHue = 0, audioUrl, webAudio }: FilmProps) {
  useCleanFont();
  const f = useCurrentFrame();
  const b = beatsFromPlan(plan);
  const F = FILMS[film] ?? GlowFilm;
  const brand = { name: plan.brand.name, icon: plan.brand.icon, tagline: plan.brand.tagline, cta: plan.brand.cta, url: plan.brand.url, hue: hue + postHue, things: b.trio.map((x) => ({ label: x.label, icon: x.icon })) };
  return (
    <BrandCtx.Provider value={brand}>
      <AbsoluteFill style={{ background: "#000", overflow: "hidden", filter: hue ? `hue-rotate(${hue}deg)` : undefined }}>
        <F f={f} b={b} />
      </AbsoluteFill>
      {audioUrl && (webAudio ? <MediaAudio src={audioUrl} /> : <Html5Audio src={audioUrl} />)}
    </BrandCtx.Provider>
  );
}

// Proof: the Flowly script in film 0–3.
export function RefFilm({ film }: { film: number }) {
  return <Film plan={flowlyPlan(0)} film={FILM_IDS[film] ?? "glow"} />;
}
