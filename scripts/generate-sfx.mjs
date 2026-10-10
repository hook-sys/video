// Synthesizes the storyboard sound effects in public/sfx/. Every sound is
// generated from scratch here (oscillators + seeded noise), so the files are
// original works with no third-party licence. Re-run: node scripts/generate-sfx.mjs
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const RATE = 44100;
const PEAK = 0.5; // -6 dBFS; playback volume lowers it further

let seed = 1;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;

const buffer = (seconds) => new Float32Array(Math.round(seconds * RATE));
const env = (t, attack, decay) => (t < attack ? t / attack : Math.exp(-(t - attack) / decay));

function lowpass(x, cutoff) {
  const a = 1 - Math.exp((-2 * Math.PI * cutoff) / RATE);
  let y = 0;
  return x.map((v) => (y += a * (v - y)));
}

// State-variable band-pass with a per-sample centre frequency.
function bandpass(x, freqAt, q = 2) {
  let low = 0, band = 0;
  return x.map((v, i) => {
    const f = 2 * Math.sin((Math.PI * freqAt(i / RATE)) / RATE);
    low += f * band;
    const high = v - low - band / q;
    band += f * high;
    return band;
  });
}

function tone(out, start, seconds, freqAt, amp, attack, decay, harmonics = [1]) {
  let phase = 0;
  const from = Math.round(start * RATE);
  for (let i = 0; i < seconds * RATE && from + i < out.length; i++) {
    const t = i / RATE;
    phase += (2 * Math.PI * freqAt(t)) / RATE;
    const s = harmonics.reduce((sum, h, k) => sum + Math.sin(phase * (k + 1)) * h, 0);
    out[from + i] += s * amp * env(t, attack, decay);
  }
}

function tick(out, start, amp, bright) {
  const from = Math.round(start * RATE);
  const n = Math.round(0.03 * RATE);
  const burst = new Float32Array(n).map((_, i) => rand() * Math.exp(-i / RATE / 0.004));
  const shaped = lowpass(burst, bright);
  for (let i = 0; i < n && from + i < out.length; i++) out[from + i] += shaped[i] * amp;
}

const SOUNDS = {
  whoosh() {
    const d = 0.6;
    const noise = buffer(d).map(rand);
    const swept = bandpass(noise, (t) => 300 + 2400 * Math.sin((Math.PI * t) / d) ** 2, 1.5);
    return swept.map((v, i) => v * Math.sin((Math.PI * i) / swept.length) ** 2);
  },
  soft_pop() {
    const out = buffer(0.15);
    tone(out, 0, 0.15, (t) => 180 + 520 * Math.exp(-t / 0.02), 1, 0.002, 0.035);
    return out;
  },
  click() {
    const out = buffer(0.06);
    tick(out, 0, 1, 5000);
    tone(out, 0, 0.04, () => 2200, 0.25, 0.0005, 0.006);
    return out;
  },
  typing() {
    const out = buffer(0.75);
    let t = 0.01;
    while (t < 0.65) {
      tick(out, t, 0.6 + 0.4 * Math.abs(rand()), 3000 + 2500 * Math.abs(rand()));
      t += 0.065 + 0.05 * Math.abs(rand());
    }
    return out;
  },
  digital_processing() {
    const out = buffer(0.8);
    const notes = [880, 1175, 1319, 1568, 1760];
    for (let t = 0; t < 0.72; t += 0.06) {
      const f = notes[Math.floor(Math.abs(rand()) * notes.length)];
      tone(out, t, 0.05, () => f, 0.35, 0.002, 0.015, [1, 0, 0.3]);
    }
    return lowpass(out, 4000);
  },
  reveal() {
    const d = 0.9;
    const out = buffer(d);
    tone(out, 0, d, (t) => 500 + 900 * (t / d), 0.5, 0.35, 0.25, [1, 0.3]);
    const air = bandpass(buffer(d).map(rand), () => 6000, 3);
    return out.map((v, i) => v + air[i] * 0.4 * Math.sin((Math.PI * i) / out.length));
  },
  success_chime() {
    const out = buffer(1.1);
    tone(out, 0, 1.1, () => 1047, 0.5, 0.004, 0.3, [1, 0.25, 0.08]);
    tone(out, 0.1, 1.0, () => 1568, 0.45, 0.004, 0.35, [1, 0.2, 0.05]);
    return out;
  },
  subtle_impact() {
    const out = buffer(0.6);
    tone(out, 0, 0.6, (t) => 45 + 75 * Math.exp(-t / 0.05), 1, 0.003, 0.15);
    const thump = lowpass(buffer(0.6).map(rand), 400);
    return out.map((v, i) => v + thump[i] * 0.8 * Math.exp(-i / RATE / 0.03));
  },
};

function normalize(x) {
  const n = Math.round(0.004 * RATE); // short fade-out avoids end clicks
  x.forEach((_, i) => i >= x.length - n && (x[i] *= (x.length - i) / n));
  const peak = x.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1;
  return x.map((v) => (v / peak) * PEAK);
}

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), i * 2));
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(RATE, 24); h.writeUInt32LE(RATE * 2, 28); h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

// Remotion ships an ffmpeg build with libmp3lame; FFMPEG overrides it.
const compositor = path.resolve("node_modules/@remotion/compositor-linux-x64-gnu");
const ffmpeg = process.env.FFMPEG ?? path.join(compositor, "ffmpeg");
const outDir = path.resolve("public/sfx");
const tmp = mkdtempSync(path.join(tmpdir(), "sfx-"));
mkdirSync(outDir, { recursive: true });
for (const [name, make] of Object.entries(SOUNDS)) {
  const src = path.join(tmp, `${name}.wav`);
  writeFileSync(src, wav(normalize(make())));
  execFileSync(ffmpeg, ["-y", "-loglevel", "error", "-i", src, "-ac", "1", "-b:a", "96k", path.join(outDir, `${name}.mp3`)], {
    env: { ...process.env, LD_LIBRARY_PATH: compositor },
  });
  console.log(`public/sfx/${name}.mp3`);
}
rmSync(tmp, { recursive: true });
