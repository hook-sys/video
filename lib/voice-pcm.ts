import "server-only";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { alignScript, pausesOf } from "@/lib/voice-align";
import type { WordTiming } from "@/lib/voice-timing";

// The voice as samples, by the ffmpeg Remotion already ships for this machine
// (@remotion/compositor-<platform>), else one on the PATH; null when there is
// none — the timing then falls back to Whisper.

const RATE = 8000;
const require_ = createRequire(import.meta.url);
function ffmpegPath(): string | null {
  const name = `@remotion/compositor-${process.platform}-${process.arch}${process.platform === "linux" ? "-gnu" : process.platform === "win32" ? "-msvc" : ""}`;
  const exe = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
  // (where the package resolves from here, else under the app's own node_modules — a deployed function's files)
  const dirs: string[] = [path.join(process.cwd(), "node_modules", name)];
  try {
    dirs.unshift(path.dirname(require_.resolve(`${name}/package.json`)));
  } catch {
    // not resolvable from the bundle
  }
  return dirs.map((d) => path.join(d, exe)).find((b) => existsSync(b)) ?? null;
}

// mono samples at 8 kHz from an audio file's bytes
export async function samplesOf(audio: Uint8Array): Promise<Int16Array | null> {
  const bin = ffmpegPath() ?? "ffmpeg";
  const dir = await mkdtemp(path.join(tmpdir(), "voice-"));
  try {
    const file = path.join(dir, "voice");
    await writeFile(file, audio);
    const wav = await new Promise<Buffer | null>((resolve) => {
      const p = spawn(bin, ["-v", "error", "-i", file, "-ac", "1", "-ar", String(RATE), "-c:a", "pcm_s16le", "-f", "wav", "-"], { env: { ...process.env, LD_LIBRARY_PATH: [path.dirname(bin), process.env.LD_LIBRARY_PATH].filter(Boolean).join(":") } });
      const out: Buffer[] = [];
      p.stdout.on("data", (d: Buffer) => out.push(d));
      p.on("error", () => resolve(null));
      p.on("close", (code) => resolve(code === 0 ? Buffer.concat(out) : null));
    });
    if (!wav || wav.length < 1000) return null;
    // (after the 44-byte header: the samples)
    const body = wav.subarray(44);
    return new Int16Array(body.buffer.slice(body.byteOffset, body.byteOffset + (body.length & ~1)));
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

// The script's own words on its voice, by the voice's pauses (lib/voice-align.ts); null when it cannot be
export async function alignVoice(audioUrl: string, script: string): Promise<WordTiming[] | null> {
  const res = await fetch(audioUrl, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) return null;
  const pcm = await samplesOf(new Uint8Array(await res.arrayBuffer()));
  if (!pcm) return null;
  const { pauses, duration } = pausesOf(pcm, RATE);
  return alignScript(script, pauses, duration);
}
