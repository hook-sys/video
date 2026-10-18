"use client";

import { useRef, useState } from "react";
import { VOICE_LIBRARY, voiceInfo, voiceSample } from "@/lib/voices";
import { VOICE_LANGUAGES } from "@/lib/projects";

// The new-video form's parts (create-project-form-v2.tsx).

const label = "text-sm font-medium";

export type Prefill = { script: string; brandName: string; websiteUrl: string; voice?: string };
type VoiceOption = { name: string; gender: "female" | "male"; label: string };

// The brand's colour, read from its icon: the most common colourful shade
// (a black, white or grey icon gives the house blue).
// `none`: what a colourless icon gives (the new version: "" — its colour is drawn from a hue)
export async function colourOf(url: string, none = "#0A66D6"): Promise<string> {
  const img = new Image();
  img.src = url;
  await img.decode();
  const c = document.createElement("canvas");
  c.width = c.height = 48;
  const g = c.getContext("2d");
  if (!g) return none;
  g.drawImage(img, 0, 0, 48, 48);
  const px = g.getImageData(0, 0, 48, 48).data;
  const bins = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < px.length; i += 4) {
    const [r, gr, b, a] = [px[i], px[i + 1], px[i + 2], px[i + 3]];
    const max = Math.max(r, gr, b), min = Math.min(r, gr, b);
    if (a < 200 || max < 40 || max - min < 40) continue;
    const hue = max === r ? ((gr - b) / (max - min) + 6) % 6 : max === gr ? (b - r) / (max - min) + 2 : (r - gr) / (max - min) + 4;
    const k = Math.round(hue * 2) % 12;
    const bin = bins.get(k) ?? { n: 0, r: 0, g: 0, b: 0 };
    bins.set(k, { n: bin.n + 1, r: bin.r + r, g: bin.g + gr, b: bin.b + b });
  }
  const best = [...bins.values()].sort((a, b) => b.n - a.n)[0];
  if (!best || best.n < 12) return none;
  const hex = (v: number) => Math.round(v / best.n).toString(16).padStart(2, "0");
  return `#${hex(best.r)}${hex(best.g)}${hex(best.b)}`.toUpperCase();
}

export function Step({ n, title, sub, children }: { n: number; title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-white/70 p-5 ring-1 ring-black/[0.06] sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#1d1d1f] text-xs font-bold text-white">{n}</span>
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          {sub && <p className="mt-0.5 text-xs text-foreground/55">{sub}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

export function Field({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={label}>{title}</span>
      {children}
    </label>
  );
}

export function Upload({ title, text, sub, preview, children }: { title: string; text: string; sub: string; preview?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className={label}>{title}</span>
      <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-foreground/20 bg-white/60 px-3 py-4 text-center text-sm hover:border-[#0a66d6]/60 hover:bg-white">
        {preview ?? <span className="flex size-9 items-center justify-center rounded-full bg-[#0a66d6]/10 text-lg text-[#0a66d6]">↑</span>}
        <span className="max-w-full truncate font-medium text-foreground/80">{text}</span>
        <span className="max-w-full truncate text-[11px] text-foreground/45">{sub}</span>
        {children}
      </label>
    </div>
  );
}

// The voice: English only; five women's and five men's voices (the ones
// offered on /admin/models, with what each suits), each with a sample.
export function VoicePicker({ voices, initial }: { voices: VoiceOption[]; initial?: string }) {
  const list = (voices.length ? voices : VOICE_LIBRARY.map((v) => ({ name: v.name, gender: v.gender, label: "" }))).map((v) => ({ ...v, info: voiceInfo(v.name) }));
  const first = list.find((v) => v.name === initial) ?? list.find((v) => v.gender === "female") ?? list[0];
  const [gender, setGender] = useState<"female" | "male">(first?.gender ?? "female");
  const [picked, setPicked] = useState<string>(first?.name ?? "");
  const [playing, setPlaying] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const shown = list.filter((v) => v.gender === gender);
  const play = (name: string) => {
    audio.current?.pause();
    if (playing === name) return setPlaying(null);
    const a = new Audio(voiceSample(name));
    audio.current = a;
    a.onended = () => setPlaying(null);
    a.play().then(() => setPlaying(name)).catch(() => setPlaying(null));
  };
  const choose = (g: "female" | "male") => {
    setGender(g);
    const keep = list.find((v) => v.gender === g && v.name === picked);
    if (!keep) setPicked(list.find((v) => v.gender === g)?.name ?? "");
  };
  return (
    <div className="flex flex-col gap-4">
      <input type="hidden" name="voice_language" value={VOICE_LANGUAGES[0]} />
      <input type="hidden" name="voice_gender" value={gender} />
      <input type="hidden" name="voice_name" value={picked} />
      <div className="flex gap-2">
        {(["female", "male"] as const).filter((g) => list.some((v) => v.gender === g)).map((g) => (
          <button key={g} type="button" onClick={() => choose(g)} className={`rounded-full border px-3.5 py-1.5 text-sm ${gender === g ? "border-[#0a66d6] bg-[#0a66d6]/10 font-medium text-[#0a66d6]" : "border-foreground/12 bg-white/70 hover:border-foreground/30"}`}>
            {g === "female" ? "Female" : "Male"}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {shown.map((v) => (
          <div key={v.name} role="radio" aria-checked={picked === v.name} tabIndex={0} onClick={() => setPicked(v.name)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setPicked(v.name))} className={`flex cursor-pointer items-start gap-3 rounded-2xl border bg-white/70 p-3.5 text-left ${picked === v.name ? "border-[#0a66d6] ring-4 ring-[#0a66d6]/15" : "border-foreground/10 hover:bg-white"}`}>
            <button type="button" aria-label={`Play ${v.name}`} onClick={(e) => (e.stopPropagation(), play(v.name))} className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#0a66d6] text-sm text-white hover:bg-[#0859bd]">
              {playing === v.name ? "■" : "▶"}
            </button>
            <span className="flex min-w-0 flex-col">
              <span className="text-sm font-semibold">
                {v.name}
                {v.info && <span className="ml-1.5 text-xs font-normal text-foreground/50">{v.info.accent} · {v.info.tone}</span>}
              </span>
              <span className="text-xs text-foreground/60">{v.info ? `Best for: ${v.info.bestFor}` : v.label}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// A picture made smaller in the browser before it is sent (a JPEG at most
// `width` wide), so pictures, the icon and a recording fit one request.
export function smaller(file: File, width = 1600, quality = 0.82): Promise<File> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, width / img.naturalWidth);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => (b ? resolve(new File([b], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" })) : reject(new Error("unreadable"))), "image/jpeg", quality);
    };
    img.onerror = () => (URL.revokeObjectURL(url), reject(new Error(`${file.name}: not a picture`)));
    img.src = url;
  });
}
