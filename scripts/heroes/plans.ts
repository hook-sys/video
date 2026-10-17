import { hueOf, rng } from "@/components/video/composer/art";
import { drawArt } from "@/components/video/composer/auto";
import { placeAll } from "@/components/video/composer/layout";
import { resolveHero } from "@/components/video/composer/heroes/slots";
import type { CameraKind, ComposerPlan, FieldKind, HeroT, SceneT, Word } from "@/components/video/composer/types";

// One-scene films of logo_end and growth_chart, in the three frames, for the
// Player and the in-browser renderer. The logo is the uploaded file (a URL
// the renderer's browser can load). Sound is off so a missing file cannot
// hold the frame.

const BRAND = {
  name: "Orin ERP",
  color: "#2457ff",
  tagline: "The Textile Mill Operating Platform",
  cta: "Book a free demo",
  url: "orin.example",
};

const say = (parts: [string, number, number][]): Word[] => parts.map(([text, start, end]) => ({ text, start, end }));

const LOGO_WORDS = say([
  ["Book", 0.35, 0.55],
  ["a", 0.6, 0.72],
  ["free", 0.78, 1.05],
  ["demo", 1.1, 1.45],
]);

const CHART_WORDS = say([
  ["Orders", 0.2, 0.48],
  ["grow", 0.55, 0.9],
  ["3x", 1.1, 1.45],
  ["this", 1.6, 1.82],
  ["quarter", 1.88, 2.25],
]);

type Shot = {
  name: string;
  words: Word[];
  size: [number, number];
  seed: number;
  camera: CameraKind;
  scheme: "light" | "dark";
  field: FieldKind;
  hero: HeroT;
  frame: number;
};

function shot(logoUrl: string, s: Shot): { name: string; plan: ComposerPlan; frame: number } {
  const brand = { ...BRAND, icon: logoUrl };
  const resolved = resolveHero(s.hero, s.words, brand);
  if (!resolved) throw new Error(`${s.name}: hero slots did not resolve`);
  const art = drawArt(rng(s.seed), brand.color);
  art.hue = hueOf(brand.color);
  art.harmony = "analogous";
  art.scheme = s.scheme;
  art.field = s.field;
  art.energy = 0.62;
  art.name = "hero";
  const scene: SceneT = {
    at: 0,
    text: null,
    kicker: null,
    layout: "center",
    arrange: null,
    ratio: null,
    dark: s.scheme === "dark",
    camera: s.camera,
    enter: "blur",
    items: [],
    hero: s.hero,
  };
  const { plan, problems } = placeAll({ art, scenes: [scene] }, s.words, 120, brand, s.seed, 0, "auto", s.size);
  plan.sfx = false;
  if (plan.scenes[0]?.hero?.id !== s.hero.id) throw new Error(`${s.name}: hero was dropped while placing`);
  if (problems.length) console.warn(`${s.name}: ${problems.map((p) => p.what).join("; ")}`);
  return { name: s.name, plan, frame: s.frame };
}

export function heroPlans(logoUrl: string): { name: string; plan: ComposerPlan; frame: number }[] {
  const sizes: [string, number, number][] = [
    ["16x9", 1920, 1080],
    ["9x16", 1080, 1920],
    ["1x1", 1080, 1080],
  ];
  const logoCam: CameraKind[] = ["push", "float", "rise"];
  const chartCam: CameraKind[] = ["pull", "rise", "drift"];
  const fields: FieldKind[] = ["aurora", "mesh", "discs", "spot", "arcs", "rings"];
  const out: { name: string; plan: ComposerPlan; frame: number }[] = [];
  sizes.forEach(([ratio, w, h], i) => {
    out.push(shot(logoUrl, {
      name: `logo_end-${ratio}`,
      words: LOGO_WORDS,
      size: [w, h],
      seed: 4100 + i * 131,
      camera: logoCam[i],
      scheme: i === 1 ? "dark" : "light",
      field: fields[i],
      frame: 78,
      hero: {
        id: "logo_end",
        variant: [3, 1, 0][i],
        slots: {
          logo: { source: "brand" },
          tagline: { text: BRAND.tagline },
          cta: { text: BRAND.cta, words: [0, 3] },
        },
      },
    }));
    out.push(shot(logoUrl, {
      name: `growth_chart-${ratio}`,
      words: CHART_WORDS,
      size: [w, h],
      seed: 6200 + i * 173,
      camera: chartCam[i],
      scheme: i === 0 ? "dark" : "light",
      field: fields[i + 3],
      frame: 78,
      hero: {
        id: "growth_chart",
        variant: [3, 1, 0][i],
        slots: {
          metricLabel: { text: "Orders grow", words: [0, 1] },
          value: { value: "3x", word: 2 },
          caption: { text: "this quarter", words: [3, 4] },
        },
      },
    }));
  });
  return out;
}
