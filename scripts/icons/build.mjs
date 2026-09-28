#!/usr/bin/env node
// Builds the motion-graphics icon library from the curated catalog.
//
//   npm run icons:build
//
// Reads Lucide's icon nodes (devDependency lucide-static) and writes:
//   components/video/icons/icons.json   name → one compact SVG path (24×24,
//                                        stroke), plus a fill path for the few
//                                        icons with solid dots
//   components/video/icons/catalog.json categories + search keywords (for the
//                                        Visual Director), no geometry
// Every shape (circle, rect, line, polyline…) becomes path data so an icon is a
// single <path>: small, and it can be "drawn on" with pathLength.

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CATEGORIES } from "./catalog.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const lucide = path.join(root, "node_modules/lucide-static");
const nodes = JSON.parse(readFileSync(path.join(lucide, "icon-nodes.json"), "utf8"));
const tags = JSON.parse(readFileSync(path.join(lucide, "tags.json"), "utf8"));
const version = JSON.parse(readFileSync(path.join(lucide, "package.json"), "utf8")).version;

const n = (v) => +(+v).toFixed(3); // number, rounded
const f = (v) => String(n(v)); // formatted

function toPath(tag, a) {
  switch (tag) {
    case "path":
      return a.d;
    case "circle": {
      const [cx, cy, r] = [n(a.cx), n(a.cy), n(a.r)];
      return `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0`;
    }
    case "ellipse": {
      const [cx, cy, rx, ry] = [n(a.cx), n(a.cy), n(a.rx), n(a.ry)];
      return `M${f(cx - rx)} ${f(cy)}a${f(rx)} ${f(ry)} 0 1 0 ${f(2 * rx)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-2 * rx)} 0`;
    }
    case "rect": {
      const [x, y, w, h] = [n(a.x ?? 0), n(a.y ?? 0), n(a.width), n(a.height)];
      let rx = n(a.rx ?? a.ry ?? 0);
      let ry = n(a.ry ?? a.rx ?? 0);
      rx = Math.min(rx, w / 2);
      ry = Math.min(ry, h / 2);
      if (!rx || !ry) return `M${f(x)} ${f(y)}h${f(w)}v${f(h)}h${f(-w)}z`;
      const arc = (dx, dy) => `a${f(rx)} ${f(ry)} 0 0 1 ${f(dx)} ${f(dy)}`;
      return `M${f(x + rx)} ${f(y)}h${f(w - 2 * rx)}${arc(rx, ry)}v${f(h - 2 * ry)}${arc(-rx, ry)}h${f(-(w - 2 * rx))}${arc(-rx, -ry)}v${f(-(h - 2 * ry))}${arc(rx, -ry)}z`;
    }
    case "line":
      return `M${f(a.x1)} ${f(a.y1)}L${f(a.x2)} ${f(a.y2)}`;
    case "polyline":
    case "polygon": {
      const pts = a.points.trim().split(/[\s,]+/).map(f);
      let d = `M${pts[0]} ${pts[1]}`;
      for (let i = 2; i < pts.length; i += 2) d += `L${pts[i]} ${pts[i + 1]}`;
      return tag === "polygon" ? d + "z" : d;
    }
    default:
      throw new Error(`unsupported element <${tag}>`);
  }
}

// Whitespace-minimal path data (still plain SVG path syntax).
// The first moveto of a path is absolute even when written "m"; once paths are
// concatenated it would become relative to the previous one. "m x y a b…"
// → "M x y l a b…" (coordinates after a relative moveto are relative linetos).
const NUM = String.raw`[-+]?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?`;
const LEADING_M = new RegExp(String.raw`^m\s*(${NUM})[\s,]*(${NUM})\s*,?\s*`);
function absoluteStart(d) {
  const m = d.trim().match(LEADING_M);
  if (!m) return d.trim();
  const rest = d.trim().slice(m[0].length);
  return `M${m[1]} ${m[2]}${/^[-+.\d]/.test(rest) ? "l" : ""}${rest}`;
}

const minify = (d) =>
  absoluteStart(d)
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s*([a-zA-Z])\s*/g, "$1")
    .replace(/ -/g, "-")
    .replace(/(^|[^\d.])0\.(\d)/g, "$1.$2")
    .trim();

const icons = {};
const missing = [];
const categories = {};
for (const [cat, names] of Object.entries(CATEGORIES)) {
  categories[cat] = [];
  for (const name of names) {
    if (!nodes[name]) {
      missing.push(`${cat}/${name}`);
      continue;
    }
    if (!categories[cat].includes(name)) categories[cat].push(name);
    if (icons[name]) continue;
    const stroke = [];
    const fill = [];
    for (const [tag, attrs] of nodes[name]) (attrs.fill && attrs.fill !== "none" ? fill : stroke).push(minify(toPath(tag, attrs)));
    icons[name] = fill.length ? [stroke.join(""), fill.join("")] : stroke.join("");
  }
}

const names = Object.keys(icons).sort();
const sorted = Object.fromEntries(names.map((k) => [k, icons[k]]));
const keywords = Object.fromEntries(names.map((k) => [k, (tags[k] ?? []).slice(0, 8)]));
const outDir = path.join(root, "components/video/icons");
writeFileSync(path.join(outDir, "icons.json"), JSON.stringify(sorted));
writeFileSync(path.join(outDir, "catalog.json"), JSON.stringify({ source: `lucide-static@${version} (ISC)`, categories, keywords }));

const size = (file) => readFileSync(path.join(outDir, file)).byteLength;
console.log(`icons: ${names.length} unique across ${Object.keys(categories).length} categories`);
console.log(`icons.json ${(size("icons.json") / 1024).toFixed(1)} KB, catalog.json ${(size("catalog.json") / 1024).toFixed(1)} KB`);
if (missing.length) console.log(`skipped (not in Lucide ${version}): ${missing.join(", ")}`);
