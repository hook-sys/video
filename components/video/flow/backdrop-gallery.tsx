import { AbsoluteFill, useCurrentFrame } from "remotion";
import { BACKDROPS } from "./backdrop-names";
import { Backdrop } from "./backdrops";
import { World } from "./flow-scene";
import { THEMES } from "./themes";
import type { ThemeName } from "./types";

// QA only: every scene backdrop at quarter size, 4 × 4, over the theme's mesh.
export const BACKDROP_GALLERY_ID = "BackdropGallery";

export function BackdropGallery({ theme = "lavender" }: { theme?: ThemeName }) {
  const frame = useCurrentFrame();
  const th = THEMES[theme];
  return (
    <AbsoluteFill style={{ background: "#111" }}>
      {BACKDROPS.map((kind, i) => (
        <div key={kind} style={{ position: "absolute", left: (i % 4) * 480, top: Math.floor(i / 4) * 270, width: 480, height: 270, overflow: "hidden" }}>
          <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, transform: "scale(0.25)", transformOrigin: "0 0" }}>
            <World theme={th} frame={frame} camera={[0, 0]} />
            <Backdrop kind={kind} frame={frame} theme={th} camera={[0, 0]} opacity={1} />
          </div>
          <div style={{ position: "absolute", left: 8, top: 6, fontSize: 18, fontWeight: 700, color: th.dark ? "#fff" : "#111", fontFamily: "sans-serif" }}>{kind}</div>
        </div>
      ))}
    </AbsoluteFill>
  );
}
