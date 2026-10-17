import type { Brand, CameraKind, SceneT, ScriptT, Word } from "../types";
import { cameraFor, cutWords, spokenToken } from "./slots";

// Attach hero scenes on a v2 script. The Director's items and words stay, so
// a hero that cannot be drawn (no logo yet, a required slot missing) falls
// back to the kinetic scene. Same hero never twice in a row, and at most
// twice in the video. logo_end is always the last scene.

const KEYS = ["grow", "growth", "increase", "faster", "results", "percent", "boost", "double", "save", "বাড়", "বৃদ্ধি", "দ্রুত", "ফলাফল", "শতাংশ", "দ্বিগুণ", "সময়"];
const STOP = new Set(["the", "a", "an", "and", "or", "to", "of", "in", "on", "for", "your", "our", "with", "is", "it", "its", "at", "by", "from", "this", "that", "just", "more", "no", "when", "into", "one"]);

const clean = (t: string) => t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}%]+$/gu, "");

// A contiguous run of the spoken words, so the slot's [from, to] reproduces
// the text. Stops before a spoken number and before maxChars.
function phrase(words: Word[], lo: number, hi: number, max: number): { text: string; from: number; to: number } | null {
  let i = Math.max(0, lo);
  const end = Math.min(hi, words.length - 1);
  while (i <= end && (!clean(words[i]?.text ?? "") || STOP.has(clean(words[i].text).toLowerCase()) || !!spokenToken(words[i].text))) i++;
  if (i > end) return null;
  const from = i;
  const parts: string[] = [];
  let to = i;
  for (; i <= end; i++) {
    const bit = words[i]?.text ?? "";
    if (spokenToken(bit) && parts.length) break;
    if (!clean(bit)) continue;
    const next = [...parts, bit].join(" ").replace(/\s+/g, " ").trim();
    if (next.length > max) break;
    parts.push(bit);
    to = i;
  }
  const text = cutWords(parts.join(" "), max);
  return text ? { text, from, to } : null;
}

function rangeOf(sc: SceneT, nextAt: number, n: number): [number, number] {
  const lo = Math.max(0, Math.min(n - 1, sc.text?.from ?? sc.at));
  const hi = Math.max(lo, Math.min(n - 1, sc.text?.to ?? nextAt - 1));
  return [lo, hi];
}

export function withHeroes(script: ScriptT, words: Word[], brand: Brand, seed: number): { script: ScriptT; notes: string[] } {
  const notes: string[] = [];
  const n = words.length;
  if (!n || !script.scenes.length) return { script, notes };
  let growths = 0;
  let prev: "logo_end" | "growth_chart" | null = null;
  let prevCam: CameraKind | null = null;
  const scenes = script.scenes.map((sc, i) => {
    const last = i === script.scenes.length - 1;
    const nextAt = script.scenes[i + 1]?.at ?? n;
    const [lo, hi] = rangeOf(sc, nextAt, n);
    const slice = words.slice(lo, hi + 1);
    const blob = slice.map((w) => w.text.toLowerCase()).join(" ");
    let next: SceneT = sc;
    if (last && brand.name?.trim()) {
      const variant = (Math.imul(seed ^ 0x9e3779b1, i + 1) >>> 0) % 12;
      const tagline = brand.tagline ? cutWords(brand.tagline, 36) : null;
      const cta = brand.cta ? cutWords(brand.cta, 24) : null;
      const camera = cameraFor("logo_end", sc.camera, prevCam, seed + i * 3);
      next = {
        ...sc,
        camera,
        hero: {
          id: "logo_end",
          variant,
          slots: {
            logo: { source: "brand" },
            brandName: { text: brand.name.trim() },
            ...(tagline ? { tagline: { text: tagline } } : {}),
            ...(cta ? { cta: { text: cta } } : {}),
          },
        },
      };
      notes.push(brand.icon ? "logo_end on the last scene, uploaded logo" : "logo_end on the last scene; the logo is read when the film is drawn");
      prev = "logo_end";
      prevCam = camera;
      return next;
    }
    const numbered = slice.map((w, k) => ({ w, i: lo + k, token: spokenToken(w.text) })).find((x) => x.token);
    const keyed = KEYS.some((k) => blob.includes(k));
    if (!last && prev !== "growth_chart" && growths < 2 && (keyed || numbered)) {
      const label = phrase(words, lo, hi, 20);
      if (label) {
        const variant = (Math.imul(seed ^ 0x85ebca6b, i + 3) >>> 0) % 12;
        const caption = phrase(words, label.to + 1, hi, 36);
        const camera = cameraFor("growth_chart", sc.camera, prevCam, seed + i * 5);
        next = {
          ...sc,
          camera,
          hero: {
            id: "growth_chart",
            variant,
            slots: {
              metricLabel: { text: label.text, words: [label.from, label.to] },
              ...(numbered?.token ? { value: { value: numbered.token, word: numbered.i } } : {}),
              ...(caption ? { caption: { text: caption.text, words: [caption.from, caption.to] } } : {}),
            },
          },
        };
        growths += 1;
        prev = "growth_chart";
        prevCam = camera;
        notes.push(`growth_chart on scene ${i + 1}${numbered?.token ? ` (spoken ${numbered.token})` : " (no spoken number)"}`);
        return next;
      }
    }
    prev = null;
    prevCam = sc.camera ?? prevCam;
    return sc;
  });
  return { script: { ...script, scenes }, notes };
}
