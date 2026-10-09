// The film's frame: 1920×1080 (16:9), 1080×1920 (9:16) or 1080×1080 (1:1).
// Every part reads W and H from here (live bindings), and a film sets its
// frame once, before it is laid out (placeAll) or drawn (ComposerFilm) —
// both run start to end without yielding, so one film's frame never leaks
// into another's.
export type FormatKind = "16:9" | "9:16" | "1:1";
export const FRAMES: Record<FormatKind, [number, number]> = { "16:9": [1920, 1080], "9:16": [1080, 1920], "1:1": [1080, 1080] };

export let W = 1920;
export let H = 1080;
export function setFrame(w = 1920, h = 1080) {
  W = w;
  H = h;
}
export const frameOf = (format: string | null | undefined): [number, number] => FRAMES[format as FormatKind] ?? FRAMES["16:9"];
// a tall frame (9:16): side-by-side layouts stack instead
export const tall = () => H > W * 1.2;
