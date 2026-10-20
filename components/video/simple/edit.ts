import { settleWordIcons } from "./check";
import { printOf, shownWord, variantOk, wordsAlone } from "./select";
import { GROUNDS, type Ground, type Item, PACES, type Scene, type SimplePlan, TEMPLATES, type TemplateId, type Theme, TYPE_PAIRS, VARIANTS, WAYS } from "./types";

// The customer's edits of their video, guided: the look of the whole video
// (its ground, type, pace and way between scenes) and, scene by scene, how it
// is shown (a template and a variant), which of its beat's words are on
// screen and the one lit, its things, its icon, which picture of the product
// and — for at most two scenes — a ground of its own. Timing, the voice and the brand never change. The same code
// applies an edit in the browser (to preview it) and on the server (to save
// it), from the plan as stored — so nothing else can be sent in.

export type SceneEdit = { template: TemplateId; variant: number; show: [number, number] | null; key: number | null; icon: string; items: Item[]; screen: number | null; ground: Ground | null };
export type PlanEdit = { theme: Theme; scenes: SceneEdit[] };

// names a customer reads
export const TEMPLATE_NAME: Record<TemplateId, string> = { statement: "Big words", kinetic: "Moving words", trouble: "The problems", compare: "Before and after", reveal: "Brand reveal", feature: "Product card", screen: "Your product", messages: "Messages", bento: "Tiles", stat: "Big number", chart: "Chart", steps: "Steps", cta: "Ending" };
export const TYPE_NAME = ["Clean", "Modern", "Characterful", "Soft", "Bold"];
// (the templates that show the things a scene names)
export const SHOWS_THINGS: TemplateId[] = ["trouble", "compare", "reveal", "feature", "messages", "bento", "chart", "steps"];

const THING_WORDS = 3, THING_CHARS = 28;
// scenes that may stand on a ground other than the video's (more and the video stops being one piece)
export const OWN_GROUNDS = 2;
// a word as said and as shown (capitalised, a comma dropped) the same word
const same = (a: string, b: string) => a.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "") === b.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
// how many words may be on screen: beside a hero a caption of at most four; alone, or at the end, up to six
export const mostWords = (t: TemplateId, v: number) => (wordsAlone(t, v) || t === "cta" ? 6 : 4);

// The edit a plan is now (the words shown found in its beat's words)
export function editOf(plan: SimplePlan): PlanEdit {
  return {
    theme: { ...plan.theme },
    scenes: plan.scenes.map((s) => {
      let show: [number, number] | null = null;
      let key: number | null = null;
      if (s.said?.length && s.words.length) {
        // (found by its words: their times may have been brought forward to come in sooner)
        const first = s.said.findIndex((_, i) => s.words.every((w, k) => s.said![i + k] && same(s.said![i + k].t, w.t)));
        if (first >= 0) {
          show = [first, first + s.words.length - 1];
          const lit = s.words.findIndex((w) => w.key);
          key = lit >= 0 ? first + lit : null;
        }
      }
      return { template: s.template, variant: s.variant, show, key, icon: s.icon, items: s.items.map((it) => ({ ...it })), screen: s.screen ?? null, ground: s.ground && s.ground !== plan.theme.ground ? s.ground : null };
    }),
  };
}

// The plan with an edit, or why it cannot be
export function applyEdit(plan: SimplePlan, edit: PlanEdit): { plan: SimplePlan; error?: undefined } | { plan?: undefined; error: string } {
  const t = edit?.theme;
  if (!t || !GROUNDS.includes(t.ground) || !WAYS.includes(t.way) || !PACES.includes(t.pace) || !Number.isInteger(t.type) || t.type < 0 || t.type >= TYPE_PAIRS.length) return { error: "That look is not one there is." };
  if (!Array.isArray(edit.scenes) || edit.scenes.length !== plan.scenes.length) return { error: "The scenes do not match the video." };
  const shots = plan.brand.screens?.length ?? 0;
  // (a scene's own ground: one there is, other than the video's — the same as the video's is none)
  const own = edit.scenes.map((e) => (e?.ground != null && e.ground !== t.ground ? e.ground : null));
  if (own.some((g) => g !== null && !GROUNDS.includes(g))) return { error: "That background is not one there is." };
  if (own.filter(Boolean).length > OWN_GROUNDS) return { error: `At most ${OWN_GROUNDS} scenes can have a background of their own.` };
  const scenes: Scene[] = [];
  for (const [i, s] of plan.scenes.entries()) {
    const e = edit.scenes[i];
    const last = i === plan.scenes.length - 1;
    const n = `Scene ${i + 1}`;
    if (!e || !TEMPLATES.includes(e.template)) return { error: `${n}: that way of showing it is not one there is.` };
    // (the last scene is always the brand and the ask, and only it)
    if (last !== (e.template === "cta")) return { error: `${n}: ${last ? "the last scene is always the ending" : "only the last scene is the ending"}.` };
    if (e.template === "screen" && !(Number.isInteger(e.screen) && e.screen! >= 0 && e.screen! < shots)) return { error: `${n}: there is no such picture of the product.` };
    const items = Array.isArray(e.items) ? e.items : [];
    if (items.length > 3) return { error: `${n}: at most three things.` };
    const things: Item[] = [];
    for (const it of items) {
      const text = String(it?.text ?? "").trim().replace(/\s+/g, " ");
      if (!text) continue;
      if (text.length > THING_CHARS || text.split(" ").length > THING_WORDS) return { error: `${n}: "${text.slice(0, 40)}" — a thing is at most ${THING_WORDS} words.` };
      const icon = it?.icon == null ? null : String(it.icon).slice(0, 40);
      things.push({ text, icon });
    }
    if (!Number.isInteger(e.variant) || e.variant < 0 || e.variant >= VARIANTS || !variantOk(e.template, e.variant, things.length)) return { error: `${n}: that way of showing it needs more things.` };
    const icon = String(e.icon ?? "").slice(0, 40) || s.icon;
    // the words on screen: a run of its beat's own words (never typed), the lit one among them
    let words = s.words;
    if (e.show) {
      const said = s.said ?? [];
      const [a, b] = e.show;
      if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < a || b >= said.length) return { error: `${n}: those words are not in what the voice says there.` };
      // (the words as the video was made are kept as they are; a new choice keeps to the limit)
      const asMade = b - a + 1 === s.words.length && s.words.every((w, k) => same(said[a + k].t, w.t));
      if (!asMade && b - a + 1 > mostWords(e.template, e.variant)) return { error: `${n}: at most ${mostWords(e.template, e.variant)} words beside this.` };
      if (e.key != null && (e.key < a || e.key > b)) return { error: `${n}: the word lit up must be one shown.` };
      const run = said.slice(a, b + 1);
      // (as they come in in a drawn plan: as said, the first never later than 4 frames into the scene)
      const late = Math.max(0, run[0].at - (s.from + (s.from ? 4 : 0)));
      words = run.map((w, k) => ({ t: shownWord(w.t, k, run.length), at: Math.max(s.from, w.at - late), key: a + k === e.key }));
    }
    const next: Scene = { ...s, template: e.template, variant: e.variant, words, icon, items: things };
    // (a picture of the product only in a screen scene)
    if (e.template === "screen") next.screen = e.screen!;
    else delete next.screen;
    if (own[i]) next.ground = own[i]!;
    else delete next.ground;
    // (whether its lit word's icon fits is weighed again below)
    delete next.wordIcon;
    scenes.push(next);
  }
  const theme: Theme = { ground: t.ground, type: t.type, way: t.way, pace: t.pace };
  return { plan: settleWordIcons({ ...plan, theme, scenes, print: printOf(theme, scenes) }) };
}

// two edits the same (to know whether anything is left to save)
export const sameEdit = (a: PlanEdit, b: PlanEdit) => JSON.stringify(a) === JSON.stringify(b);
