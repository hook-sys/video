import { Html5Audio, Sequence, staticFile, useVideoConfig } from "remotion";
import type { SoundEffect } from "@/lib/ai/product-brief";

// Semantic sound-effect categories the storyboard's free-text cues map onto.
export type SfxKind =
  | "whoosh"
  | "soft_pop"
  | "click"
  | "typing"
  | "digital_processing"
  | "reveal"
  | "success_chime"
  | "subtle_impact";

export function sfxKindFor(cue: string): SfxKind | null {
  const c = cue.toLowerCase();
  if (/whoosh|swoosh|swipe|transition/.test(c)) return "whoosh";
  if (/typ(e|ing)|keyboard/.test(c)) return "typing";
  if (/click|tap|button/.test(c)) return "click";
  if (/pop|bubble/.test(c)) return "soft_pop";
  if (/process|digital|generat|compute|scan/.test(c)) return "digital_processing";
  if (/chime|success|ding|complete/.test(c)) return "success_chime";
  if (/impact|hit|boom|thud/.test(c)) return "subtle_impact";
  if (/reveal|shimmer|sparkle/.test(c)) return "reveal";
  return null;
}

// Short original sounds in public/sfx/, synthesized by scripts/generate-sfx.mjs
// (no third-party licence). A kind without an entry is simply skipped.
export const SFX_LIBRARY: Partial<Record<SfxKind, string>> = {
  whoosh: "sfx/whoosh.mp3",
  soft_pop: "sfx/soft_pop.mp3",
  click: "sfx/click.mp3",
  typing: "sfx/typing.mp3",
  digital_processing: "sfx/digital_processing.mp3",
  reveal: "sfx/reveal.mp3",
  success_chime: "sfx/success_chime.mp3",
  subtle_impact: "sfx/subtle_impact.mp3",
};

// Kept well under the narration so SFX stay subtle.
const SFX_VOLUME = 0.25;
const MAX_CUES = 3;
// Minimum spacing between cues, and quiet time before the scene ends, so two
// effects never start together (also across a scene boundary).
const MIN_GAP_SECONDS = 0.4;

type PlannedSfx = { from: number; src: string };

// Maps cues to files and drops unknown, out-of-range or crowded ones.
export function planSfx(cues: SoundEffect[], fps: number, durationInFrames: number): PlannedSfx[] {
  const gap = Math.round(MIN_GAP_SECONDS * fps);
  const planned: PlannedSfx[] = [];
  for (const cue of [...cues].sort((a, b) => a.at_seconds - b.at_seconds)) {
    const kind = sfxKindFor(cue.cue);
    const file = kind ? SFX_LIBRARY[kind] : undefined;
    const from = Math.round(Math.max(0, cue.at_seconds || 0) * fps);
    const last = planned[planned.length - 1];
    if (!file || from > durationInFrames - gap || (last && from - last.from < gap)) continue;
    planned.push({ from, src: staticFile(file) });
    if (planned.length === MAX_CUES) break;
  }
  return planned;
}

// Plays a scene's cues at their offsets.
export function SceneSfx({ cues }: { cues: SoundEffect[] }) {
  const { fps, durationInFrames } = useVideoConfig();
  return (
    <>
      {planSfx(cues, fps, durationInFrames).map(({ from, src }) => (
        <Sequence key={from} from={from} layout="none">
          <Html5Audio src={src} volume={SFX_VOLUME} />
        </Sequence>
      ))}
    </>
  );
}
