import { Html5Audio, Sequence, staticFile } from "remotion";
import { Audio as MediaAudio } from "@remotion/media";
import { isAccent } from "./layout";
import type { ComposerPlan, ItemKind } from "./types";

// Sound effects (no music): a soft sound on what happens, under the voice —
// a whoosh as a scene comes in, a pop as an icon comes in with its word, a
// reveal for a card or a screen, a click on the button, a chime at the end.
// Never two at once: sounds closer than a few frames keep the stronger one.

export type Sfx = { at: number; name: string; volume: number; rank: number };
const FILES = new Set(["click", "digital_processing", "reveal", "soft_pop", "subtle_impact", "success_chime", "typing", "whoosh"]);
const GAP = 9;

const ofKind = (k: ItemKind): Omit<Sfx, "at"> | null =>
  k === "icon" ? { name: "soft_pop", volume: 0.42, rank: 3 }
  : k === "stat" ? { name: "subtle_impact", volume: 0.4, rank: 4 }
  : k === "logo" ? { name: "reveal", volume: 0.36, rank: 4 }
  : k === "button" ? null
  : k === "badge" ? { name: "soft_pop", volume: 0.26, rank: 1 }
  : k === "shape" || k === "cursor" ? null
  : { name: "reveal", volume: 0.3, rank: 2 };

// When each sound plays (frames) — the plan's own moments.
export function sfxOf(plan: ComposerPlan): Sfx[] {
  if (plan.sfx === false) return [];
  const all: Sfx[] = [];
  plan.scenes.forEach((s, i) => {
    if (i > 0) all.push({ at: s.from, name: "whoosh", volume: 0.2, rank: 2 });
    for (const it of s.items) {
      const k = ofKind(it.kind);
      if (k && !(isAccent(it) && it.kind !== "badge")) all.push({ at: Math.max(0, it.at), ...k });
      if (it.kind === "button") all.push({ at: Math.max(0, it.hit ?? it.at + 18), name: "click", volume: 0.45, rank: 5 });
    }
  });
  const last = plan.scenes.at(-1);
  const ask = last?.items.find((it) => it.kind === "button");
  if (ask) all.push({ at: (ask.hit ?? ask.at + 18) + 10, name: "success_chime", volume: 0.34, rank: 6 });
  // never two at once (the stronger kept), never past the end
  const out: Sfx[] = [];
  for (const e of all.filter((x) => FILES.has(x.name) && x.at < plan.duration - 6).sort((a, b) => a.at - b.at || b.rank - a.rank)) {
    const prev = out[out.length - 1];
    if (prev && e.at - prev.at < GAP) {
      if (e.rank > prev.rank) out[out.length - 1] = e;
      continue;
    }
    out.push(e);
  }
  return out;
}

export function SoundEffects({ plan, webAudio }: { plan: ComposerPlan; webAudio?: boolean }) {
  return (
    <>
      {sfxOf(plan).map((e, i) => (
        <Sequence key={i} from={e.at} durationInFrames={Math.min(90, plan.duration - e.at)} layout="none">
          {webAudio ? <MediaAudio src={staticFile(`/sfx/${e.name}.mp3`)} volume={e.volume} /> : <Html5Audio src={staticFile(`/sfx/${e.name}.mp3`)} volume={e.volume} />}
        </Sequence>
      ))}
    </>
  );
}
