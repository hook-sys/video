import { AbsoluteFill } from "remotion";
import { LOTTIE_NAMES, LottieAnim, type LottieColors } from "./index";

// Dev/QA composition: every Lottie animation in a grid (8 × 200 px cells), all
// starting at frame 0. Used by `npm run check:story` to render and inspect them.
export const LOTTIE_GALLERY_ID = "LottieGallery";
export const GALLERY_COLS = 8;
export const GALLERY_CELL = 200;
export const galleryRows = () => Math.ceil(LOTTIE_NAMES.length / GALLERY_COLS);

export function LottieGallery({ colors }: { colors?: LottieColors }) {
  return (
    <AbsoluteFill style={{ background: "#F7F7FB" }}>
      {LOTTIE_NAMES.map((name, i) => (
        <div
          key={name}
          style={{ position: "absolute", left: (i % GALLERY_COLS) * GALLERY_CELL, top: Math.floor(i / GALLERY_COLS) * GALLERY_CELL, width: GALLERY_CELL, height: GALLERY_CELL }}
        >
          <LottieAnim name={name} colors={colors} style={{ width: GALLERY_CELL, height: GALLERY_CELL }} />
        </div>
      ))}
    </AbsoluteFill>
  );
}
