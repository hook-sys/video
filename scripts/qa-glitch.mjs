#!/usr/bin/env node
// Glitches in a rendered video (docs/video-spec.md; from the motion kit's QA):
//  FLASH — one frame unlike both neighbours while they are alike: something
//          popping in or out for a single frame, a blink. Always a bug.
//  JUMP  — a change far bigger than the motion around it: a cut. Fine where
//          scenes change (the times are printed with each scene's start);
//          anywhere else, look at that frame.
//
// Usage: node scripts/qa-glitch.mjs <video.mp4> [plan.json]
// Needs an ffmpeg with rawvideo output on the PATH (FFMPEG=… to choose one).
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const [video, planFile] = process.argv.slice(2);
if (!video) {
  console.error("Usage: node scripts/qa-glitch.mjs <video.mp4> [plan.json]");
  process.exit(1);
}
const W = 96, H = 54;
const fps = Number(execFileSync(process.env.FFPROBE ?? "ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=r_frame_rate", "-of", "csv=p=0", video]).toString().trim().split(/[\s,]+/)[0].split("/").map(Number).reduce((a, b) => a / b)) || 30;
const buf = execFileSync(process.env.FFMPEG ?? "ffmpeg", ["-v", "error", "-i", video, "-vf", `scale=${W}:${H},format=gray`, "-f", "rawvideo", "-"], { maxBuffer: 1 << 30 });
const N = Math.floor(buf.length / (W * H));
const fr = (i) => buf.subarray(i * W * H, (i + 1) * W * H);
const diff = (a, b) => {
  const A = fr(a), B = fr(b);
  let s = 0;
  for (let k = 0; k < A.length; k++) s += Math.abs(A[k] - B[k]);
  return s / A.length;
};
// (where scenes start, when the plan is given: a jump there is the cut between them)
const plan = planFile ? [JSON.parse(readFileSync(planFile, "utf8"))].flat()[0] : null;
const starts = plan ? plan.scenes.map((s) => s.from) : [];
const atCut = (i) => starts.some((f) => Math.abs(f - i) <= 12);
const d1 = Array.from({ length: N }, (_, i) => (i ? diff(i - 1, i) : 0));
let flashes = 0, jumps = 0;
for (let i = 1; i < N - 1; i++) {
  const flash = Math.min(d1[i], d1[i + 1]) - diff(i - 1, i + 1);
  const near = [d1[i - 3], d1[i - 2], d1[i + 2], d1[i + 3]].filter((x) => x !== undefined).sort((a, b) => a - b);
  const med = near[Math.floor(near.length / 2)] || 0;
  const jump = d1[i] - Math.max(med * 2.5, med + 4);
  const t = (i / fps).toFixed(2);
  if (flash > 2.5) {
    console.log(`FLASH  ${t}s  frame ${i}  score ${flash.toFixed(1)}`);
    flashes++;
  } else if (jump > 4 && !atCut(i)) {
    console.log(`JUMP   ${t}s  frame ${i}  change ${d1[i].toFixed(1)} (around it ${med.toFixed(1)})`);
    jumps++;
  }
}
console.log(`${N} frames · ${flashes} flashes · ${jumps} jumps away from a cut`);
process.exit(flashes ? 1 : 0);
