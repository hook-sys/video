"use client";

import { useRef } from "react";

// One click fills the Voice card for Gemini TTS — through fal (the fal key) or
// straight from Google (the Google key) — with five of Gemini's voices for
// customers to pick. Nothing is saved until "Save" is pressed; test it below first.

const STYLE = "Say this clearly and warmly, like a friendly product ad, in the script's own language, at a natural pace";
const CHOICES = ["Kore, female, Clear and confident", "Aoede, female, Warm and friendly", "Zephyr, female, Bright and lively", "Charon, male, Calm and informative", "Puck, male, Upbeat and energetic"].join("\n");

const PRESETS = {
  fal: {
    voice_provider: "fal",
    voice_model: "fal-ai/gemini-tts",
    voice_template: JSON.stringify({ prompt: "{{text}}", voice: "{{voice}}", model: "gemini-2.5-flash-tts", style_instructions: STYLE, output_format: "mp3" }),
  },
  google: {
    voice_provider: "google",
    voice_model: "gemini-3.8-flash-tts",
    voice_template: `${STYLE}: {{text}}`,
  },
} as const;

export function VoicePresets() {
  const box = useRef<HTMLDivElement>(null);
  const fill = (which: keyof typeof PRESETS) => {
    const form = box.current?.closest("form");
    if (!form) return;
    const set = (name: string, value: string) => {
      const el = form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
      if (el) el.value = value;
    };
    for (const [k, v] of Object.entries(PRESETS[which])) set(k, v);
    set("voice_female", "Kore");
    set("voice_male", "Charon");
    set("voice_choices", CHOICES);
  };
  const btn = "rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-200 hover:bg-violet-500/20";
  return (
    <div ref={box} className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <span className="text-xs text-zinc-400">Quick set-up — Gemini TTS with 5 voices (Kore, Aoede, Zephyr, Charon, Puck):</span>
      <button type="button" onClick={() => fill("fal")} className={btn}>
        Through fal (fal key)
      </button>
      <button type="button" onClick={() => fill("google")} className={btn}>
        Straight from Google (Gemini key)
      </button>
      <span className="w-full text-[11px] text-zinc-500">Fills the fields below; press Save, then try a voice in the test at the bottom of the page.</span>
    </div>
  );
}
