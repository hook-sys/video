import { readFileSync } from "node:fs";
import { compileSceneScript } from "@/components/video/flow/compile-scene";
import { REAL_SHOT_VIDEOS } from "@/components/video/flow/fixtures/real-shots";
import type { FlowPlan } from "@/components/video/flow/types";
import { repairCues, SceneScript } from "@/lib/scene-script";
import { expandShots, ShotScript, type Dna } from "@/lib/shots";

// The plans the parity check renders both ways: a real project's stored
// scene (16a284e8, outline icons, ribbons) and a fixture video built under
// a DNA that uses the other icon and background styles (solid icons, dots
// with the accent arc, a 3D object, the brand-colour reveal).
export function parityPlans(root: string): { name: string; plan: FlowPlan }[] {
  const real = JSON.parse(readFileSync(`${root}/scripts/parity/real-16a284e8.json`, "utf8"));
  const W = (real.words as string).split(" ").map((x) => x.split("@"));
  const words = W.map(([text, st], i) => ({ text, start: +st, end: W[i + 1] ? +W[i + 1][1] : +st + 0.7 }));
  const realPlan = compileSceneScript(SceneScript.parse(real.scene), { narration: real.script, words, durationSeconds: real.duration, brand: { name: "MotionBrief", cta: "Start working smarter today." } });

  const v = REAL_SHOT_VIDEOS[REAL_SHOT_VIDEOS.length - 1];
  const P = v.words.split(" ").map((x) => x.split("@"));
  const vw = P.map(([text, st], i) => ({ text, start: +st, end: P[i + 1] ? +P[i + 1][1] : +st + 0.5 }));
  const narration = P.map(([x]) => x).join(" ");
  const dna: Dna = { composition: "hero", cards: "accent", icons: "solid", typography: "editorial", transitions: "push", motion: "scale-reveal", camera: "push", background: "open" };
  const shots = { ...ShotScript.parse(v.shots), dna };
  const scene = repairCues(expandShots(shots, [], narration, { seed: 4242 }), narration, vw, v.duration).script;
  const fixturePlan = compileSceneScript(scene, { narration, words: vw, durationSeconds: v.duration, brand: { name: "MotionBrief", cta: "Try it free today" } });
  return [
    { name: "real 16a284e8 (outline icons, ribbons)", plan: realPlan },
    { name: "fixture MotionBrief (solid icons, dots, 3D object)", plan: fixturePlan },
  ];
}
