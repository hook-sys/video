import type { KWord } from "./text";
import type { CleanPlan } from "./types";

// Sound effects, placed on the plan's own moments (never music): a whoosh
// on each cut, a pop as a thing appears, the reveal on the product's name,
// an impact when a payment lands, processing while numbers update, the
// click and a chime at the end. Quiet under the voice; never two at once.
export type SfxKind = "whoosh" | "soft_pop" | "click" | "reveal" | "success_chime" | "subtle_impact" | "digital_processing";
export const SFX_FILES: Record<SfxKind, string> = {
  whoosh: "sfx/whoosh.mp3",
  soft_pop: "sfx/soft_pop.mp3",
  click: "sfx/click.mp3",
  reveal: "sfx/reveal.mp3",
  success_chime: "sfx/success_chime.mp3",
  subtle_impact: "sfx/subtle_impact.mp3",
  digital_processing: "sfx/digital_processing.mp3",
};
const VOLUME: Record<SfxKind, number> = { whoosh: 0.22, soft_pop: 0.3, click: 0.45, reveal: 0.35, success_chime: 0.28, subtle_impact: 0.3, digital_processing: 0.16 };
// Priority when two fall too close: the story's moments win over the cut.
const RANK: Record<SfxKind, number> = { reveal: 5, click: 5, success_chime: 4, subtle_impact: 3, soft_pop: 2, digital_processing: 2, whoosh: 1 };
const GAP = 9; // frames between two sounds

export type SfxCue = { frame: number; kind: SfxKind; volume: number };

export function planSfx(plan: CleanPlan): SfxCue[] {
  const raw: { frame: number; kind: SfxKind }[] = [];
  const add = (frame: number | undefined, kind: SfxKind) => frame !== undefined && Number.isFinite(frame) && raw.push({ frame: Math.round(frame), kind });
  plan.scenes.forEach((sc, i) => {
    if (i > 0) add(sc.from - 5, "whoosh");
    const w = (k: string) => (sc.data[k] ?? []) as KWord[];
    switch (sc.template) {
      case "hook":
        add(w("words").find((x) => x.key)?.at, "soft_pop");
        break;
      case "trio":
        for (const it of (sc.data.items ?? []) as { at: number }[]) add(it.at, "soft_pop");
        break;
      case "reveal":
        add(sc.cues.name - 3, "reveal");
        break;
      case "pay":
        add(sc.cues.pay, "subtle_impact");
        add(sc.cues.rev, "digital_processing");
        add(sc.cues.inst, "soft_pop");
        break;
      case "growth":
        add(sc.cues.grow, "digital_processing");
        add(sc.cues.team, "soft_pop");
        break;
      case "nomore":
        for (const x of [...w("a"), ...w("b")]) if (x.strike !== undefined) add(x.strike, "subtle_impact");
        break;
      case "cta":
        add(sc.from + 22, "soft_pop");
        add(sc.cues.click, "click");
        add(sc.cues.click + 8, "success_chime");
        break;
    }
  });
  const kept: { frame: number; kind: SfxKind }[] = [];
  for (const c of raw.filter((x) => x.frame >= 0 && x.frame < plan.duration - 10).sort((a, b) => RANK[b.kind] - RANK[a.kind])) {
    if (kept.some((k) => Math.abs(k.frame - c.frame) < GAP)) continue;
    kept.push(c);
  }
  return kept.sort((a, b) => a.frame - b.frame).map((c) => ({ ...c, volume: VOLUME[c.kind] }));
}
