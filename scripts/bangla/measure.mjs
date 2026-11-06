// node scripts/bangla/measure.mjs words.txt out.json — every word's width (em) in each Bangla face at its
// display weight, measured by Chromium (CHROME= its path). words.txt: corpus.txt + latin.txt (+ any script).
import { chromium } from "playwright-core";
import { readFileSync, writeFileSync } from "node:fs";
const data = (f) => `data:font/woff2;base64,${readFileSync(f).toString("base64")}`;
const [wordsFile, out] = process.argv.slice(2);
const words = [...new Set(readFileSync(wordsFile, "utf8").split(/\s+/).map((w) => w.replace(/[।,?!;:]+$/u, "")).filter(Boolean))];
const lib = new URL("../../public/fonts/library", import.meta.url).pathname;
const faces = { "anek-bangla": [800, "wght"], "hind-siliguri": [700, "700"], "baloo-da-2": [800, "wght"], "noto-sans-bengali": [800, "wght"], "noto-serif-bengali": [800, "wght"], "mina": [700, "700"], "atma": [700, "700"], "tiro-bangla": [400, "400"], "galada": [400, "400"] };
const css = Object.entries(faces).map(([slug, [w, kind]]) => {
  const bn = kind === "wght" ? `${slug}-bengali-wght-normal.woff2` : `${slug}-bengali-${kind}-normal.woff2`;
  const la = kind === "wght" ? `${slug}-latin-wght-normal.woff2` : `${slug}-latin-${kind}-normal.woff2`;
  return `@font-face{font-family:"${slug}";src:url(${data(`${lib}/${slug}/${bn}`)});font-weight:100 900;unicode-range:U+0951-0952,U+0964-0965,U+0980-09FE,U+200C-200D,U+20B9,U+25CC}@font-face{font-family:"${slug}";src:url(${data(`${lib}/${slug}/${la}`)});font-weight:100 900}`;
}).join("\n");
const b = await chromium.launch({ executablePath: process.env.CHROME ?? "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell" });
const p = await b.newPage();
await p.setContent(`<style>${css}</style><body>${Object.keys(faces).map((s) => `<span style="font-family:'${s}'">অআ abc</span>`).join("")}</body>`);
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(800);
const res = await p.evaluate(({ words, faces }) => {
  const c = document.createElement("canvas").getContext("2d");
  const o = {};
  for (const [slug, [w]] of Object.entries(faces)) {
    c.font = `${w} 100px "${slug}"`;
    o[slug] = { space: c.measureText(" ").width / 100, words: Object.fromEntries(words.map((x) => [x, c.measureText(x).width / 100])) };
  }
  return o;
}, { words, faces });
writeFileSync(out, JSON.stringify(res));
await b.close();
console.log(Object.entries(res).map(([s, r]) => `${s}: ${r.words["অ্যানালাইসিস"]?.toFixed(2)} space ${r.space.toFixed(2)}`).join("\n"));
