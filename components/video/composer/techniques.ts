import type { ScriptT } from "./types";

// The techniques taken from the references that are not a style's parts:
// ways the words come in, a way a thing comes in, a camera move. Each can be
// turned off (admin → Settings, "Techniques"); a video then uses the plain
// one in its place. (A style's parts — the orb, the design frame, confetti,
// the ghost word — have their own switches under "Looks: parts".)
export const TECHNIQUES = [
  { key: "tech_reveal_assemble", what: "reveal:assemble", label: "Words: letters assemble", help: "A word's letters come in scattered and fly together (ref 15). Off: never; the word rises in instead." },
  { key: "tech_reveal_track", what: "reveal:track", label: "Words: wide spacing closes", help: "A word comes in wide-spaced and closes up to its face's spacing (refs 09, 21). Off: never." },
  { key: "tech_reveal_beat", what: "reveal:beat", label: "Words: one word at a time", help: "With giant type, a words-only scene shows one big word at a time, each replacing the last (refs 24, 26). Off: never." },
  { key: "tech_enter_glitch", what: "enter:glitch", label: "Glitch entrance", help: "A logo (or a thing the Director picks) comes in glitching: in jumps, sliced and split into its colours (ref 25). Off: never." },
  { key: "tech_camera_macro", what: "camera:macro", label: "Macro camera", help: "The camera pushes slowly deep into the scene's main thing (ref 22). Off: never; a gentle push instead." },
] as const;

export const techOffOf = (settings: Record<string, unknown>): string[] => TECHNIQUES.filter((t) => settings[t.key] === false).map((t) => t.what);

// A script without the techniques turned off (each replaced by its plain one).
export function withoutTechniques(script: ScriptT, off: readonly string[]): ScriptT {
  if (!off.length) return script;
  const no = (k: string) => off.includes(k);
  return {
    art: no("camera:macro") && script.art.camera === "macro" ? { ...script.art, camera: "push" } : script.art,
    scenes: script.scenes.map((s) => ({
      ...s,
      text: s.text && no(`reveal:${s.text.reveal}`) ? { ...s.text, reveal: "rise" } : s.text,
      camera: s.camera && no(`camera:${s.camera}`) ? "push" : s.camera,
      items: s.items.map((it) => (it.enter && no(`enter:${it.enter}`) ? { ...it, enter: null } : it)),
    })),
  };
}
