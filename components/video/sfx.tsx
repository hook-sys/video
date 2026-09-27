import { Html5Audio, Sequence, useVideoConfig } from "remotion";
import type { SoundEffect } from "@/lib/ai/product-brief";

// Semantic sound-effect categories the storyboard's free-text cues map onto.
export type SfxKind =
  | "whoosh"
  | "pop"
  | "click"
  | "typing"
  | "processing"
  | "reveal"
  | "chime"
  | "impact";

export function sfxKindFor(cue: string): SfxKind | null {
  const c = cue.toLowerCase();
  if (/whoosh|swoosh|swipe|transition/.test(c)) return "whoosh";
  if (/typ(e|ing)|keyboard/.test(c)) return "typing";
  if (/click|tap|button/.test(c)) return "click";
  if (/pop|bubble/.test(c)) return "pop";
  if (/process|digital|generat|compute|scan/.test(c)) return "processing";
  if (/chime|success|ding|complete/.test(c)) return "chime";
  if (/impact|hit|boom|thud/.test(c)) return "impact";
  if (/reveal|shimmer|sparkle/.test(c)) return "reveal";
  return null;
}

// Audio files per category. EMPTY for now: no SFX assets are connected yet, so
// cues are planned but silent. Add licensed files (e.g. public/sfx/whoosh.mp3)
// here to enable them; no code elsewhere needs to change.
export const SFX_LIBRARY: Partial<Record<SfxKind, string>> = {};

// Kept well under the narration so SFX stay subtle.
const SFX_VOLUME = 0.25;

// Plays a scene's cues at their offsets; renders nothing when no file is mapped.
export function SceneSfx({ cues }: { cues: SoundEffect[] }) {
  const { fps, durationInFrames } = useVideoConfig();
  return (
    <>
      {cues.map((cue, i) => {
        const kind = sfxKindFor(cue.cue);
        const src = kind ? SFX_LIBRARY[kind] : undefined;
        const from = Math.round(Math.max(0, cue.at_seconds) * fps);
        if (!src || from >= durationInFrames) return null;
        return (
          <Sequence key={i} from={from} layout="none">
            <Html5Audio src={src} volume={SFX_VOLUME} />
          </Sequence>
        );
      })}
    </>
  );
}
