import type { SceneAction, SoundEffect } from "@/lib/ai/product-brief";
import { tokenize, type WordTiming } from "@/lib/voice-timing";
import { sfxKindFor } from "./sfx";
import type { RenderScene } from "./types";

export type ActionKind = SceneAction["action"];
// Seconds from the scene's start; an action lasts until the next one or the scene end.
export type TimedAction = { action: ActionKind; trigger: string; at: number; until: number };
// `spoken`: each narration word and when it is heard, in seconds from scene start.
export type SyncedScene = RenderScene & { timedActions: TimedAction[]; spoken: { text: string; at: number }[] };

// Each action's sound, as a cue the SFX library already understands.
const ACTION_SFX: Record<ActionKind, string> = {
  typing: "typing",
  processing: "digital processing",
  reveal: "reveal",
  highlight: "soft pop",
  click: "click",
  success: "success chime",
};

const LEAD = 0.12; // visuals start just before the word is heard
const MIN_SCENE = 1;
const MIN_MATCHED = 0.5; // share of narration words that must align to trust the voice timing
const SFX_GAP = 0.4;
const MAX_CUES = 3;

type Token = { text: string; scene: number; start: number };

// Tolerates inflection (e.g. "স্ক্রিপ্ট" / "স্ক্রিপ্টটি", "video" / "videos").
export const same = (a: string, b: string) =>
  a === b || (Math.min(a.length, b.length) >= 3 && (a.startsWith(b) || b.startsWith(a)));

// Walks narration and voice words in order; unmatched narration words are
// interpolated between matched neighbours. False when too little aligns.
function alignToVoice(tokens: Token[], words: WordTiming[]) {
  const stream = words.flatMap((w) => tokenize(w.text).map((t) => ({ t, start: w.start })));
  let p = 0;
  let matched = 0;
  for (const tok of tokens) {
    for (let k = p; k < Math.min(stream.length, p + 6); k++) {
      if (!same(tok.text, stream[k].t)) continue;
      tok.start = stream[k].start;
      p = k + 1;
      matched++;
      break;
    }
  }
  if (!tokens.length || matched / tokens.length < MIN_MATCHED) return false;
  const known = tokens.flatMap((t, i) => (Number.isNaN(t.start) ? [] : [i]));
  tokens.forEach((t, i) => {
    if (!Number.isNaN(t.start)) return;
    const a = known.filter((k) => k < i).at(-1);
    const b = known.find((k) => k > i);
    if (a === undefined) t.start = tokens[b!].start;
    else if (b === undefined) t.start = tokens[a].start;
    else t.start = tokens[a].start + ((tokens[b].start - tokens[a].start) * (i - a)) / (b - a);
  });
  return true;
}

// No voice timing: words are spread over each planned scene by character count.
function estimate(tokens: Token[], starts: number[], durations: number[]) {
  durations.forEach((dur, s) => {
    const own = tokens.filter((t) => t.scene === s);
    const chars = own.reduce((n, t) => n + t.text.length + 1, 0) || 1;
    let before = 0;
    for (const t of own) {
      t.start = starts[s] + dur * 0.9 * (before / chars);
      before += t.text.length + 1;
    }
  });
}

function findTrigger(own: Token[], trigger: string) {
  const want = tokenize(trigger);
  if (!want.length) return undefined;
  const at = own.findIndex((_, i) => want.every((w, j) => own[i + j] && same(own[i + j].text, w)));
  return at >= 0 ? own[at] : own.find((t) => same(t.text, want[0]));
}

// Converts the storyboard's narration-relative directions into scene timing:
// scene cuts follow the voice (when word timestamps exist), and each action
// (plus its SFX) starts when the narration reaches its trigger words.
export function syncToNarration(scenes: RenderScene[], totalSeconds: number, words?: WordTiming[]) {
  const plannedTotal = scenes.reduce((n, s) => n + Math.max(s.duration_seconds, 0), 0) || 1;
  const planned = scenes.map((s) => (Math.max(s.duration_seconds, 0) / plannedTotal) * totalSeconds);
  const plannedStarts = planned.map((_, i) => planned.slice(0, i).reduce((n, d) => n + d, 0));

  const tokens: Token[] = scenes.flatMap((s, scene) =>
    tokenize(s.narration).map((text) => ({ text, scene, start: NaN })),
  );
  const synced = !!words?.length && alignToVoice(tokens, words);
  if (!synced) estimate(tokens, plannedStarts, planned);

  // Scene cuts: just before each scene's first spoken word, keeping every scene >= 1s.
  const n = scenes.length;
  const starts = plannedStarts.map((planStart, i) => {
    const first = tokens.find((t) => t.scene === i);
    return i === 0 || !synced || !first ? planStart : first.start - LEAD;
  });
  for (let i = 1; i < n; i++) {
    starts[i] = Math.min(Math.max(starts[i], starts[i - 1] + MIN_SCENE), totalSeconds - (n - i) * MIN_SCENE);
  }
  const durations = starts.map((s, i) => (i < n - 1 ? starts[i + 1] : totalSeconds) - s);

  const result: SyncedScene[] = scenes.map((scene, i) => {
    const own = tokens.filter((t) => t.scene === i);
    const dur = durations[i];
    const found = (scene.actions ?? []).flatMap((a) => {
      const tok = findTrigger(own, a.trigger);
      if (!tok) return [];
      const at = Math.min(Math.max(tok.start - starts[i] - LEAD, 0), Math.max(dur - 0.3, 0));
      return [{ action: a.action, trigger: a.trigger, at }];
    });
    found.sort((a, b) => a.at - b.at);
    const timedActions = found.map((a, k) => ({ ...a, until: found[k + 1]?.at ?? dur }));

    // Action sounds first; planned cues only where they don't duplicate or crowd them.
    const actionCues: SoundEffect[] = timedActions.map((a) => ({ cue: ACTION_SFX[a.action], at_seconds: a.at }));
    const actionKinds = new Set(actionCues.map((c) => sfxKindFor(c.cue)));
    const planned = (scene.sound_effects ?? []).filter(
      (c) =>
        !actionKinds.has(sfxKindFor(c.cue)) &&
        actionCues.every((a) => Math.abs(a.at_seconds - c.at_seconds) >= SFX_GAP),
    );
    return {
      ...scene,
      duration_seconds: dur,
      sound_effects: [...actionCues, ...planned].slice(0, MAX_CUES),
      timedActions,
      spoken: own.map((t) => ({ text: t.text, at: Math.max(0, t.start - starts[i]) })),
    };
  });
  return { scenes: result, synced };
}
