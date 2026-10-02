import { AbsoluteFill, useCurrentFrame } from "remotion";
import { useCleanFont } from "../clean-video";
import { ConnectFilm } from "./connect";
import { DuskFilm } from "./dusk";
import { FlyFilm } from "./fly";
import { GlowFilm } from "./glow";
import { T } from "./timing";

// The four reference-style films of the Flowly script (proof).
export const REF_ID = "CleanRef";
export const REF_DURATION = T.duration;
export const REF_NAMES = ["glow", "dusk", "fly", "connect"] as const;
const FILMS = [GlowFilm, DuskFilm, FlyFilm, ConnectFilm];

export function RefFilm({ film }: { film: number }) {
  useCleanFont();
  const f = useCurrentFrame();
  const F = FILMS[film] ?? GlowFilm;
  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
      <F f={f} />
    </AbsoluteFill>
  );
}
