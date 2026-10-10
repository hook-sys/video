import { useEffect, useRef } from "react";
import { continueRender, delayRender, useCurrentFrame } from "remotion";
import { PROBE_PREFIX, type ProbeSample, type ProbeThing, type ProbeWord } from "./frame-check";
import type { PlacedItem } from "./types";

// The frame check's probe: rendered only for the check (never in a video a
// customer sees), it writes down, on every frame, where each of the words and
// each thing really is on screen and how visible it is — after the camera,
// the ways in and out, the flights, everything. The check (frame-check.ts)
// reads these lines from the browser's log.

// A thing marked for the probe: its scene, kind, words and (where it flies
// between two scenes) that it is flying.
export const qaMark = (it: PlacedItem, si: number, fly?: boolean) => ({
  "data-qa": "thing",
  "data-key": `${si}:${it.kind}:${it.title ?? ""}:${Math.round(it.box.x)}:${Math.round(it.box.y)}${fly ? ":fly" : ""}`,
  "data-kind": it.kind,
  "data-title": it.title ?? "",
  "data-scene": si,
  ...(fly ? { "data-fly": "1" } : {}),
});


// how visible an element is: its own opacity and every one above it
function seen(el: Element, stop: Element) {
  let o = 1;
  for (let e: Element | null = el; e && e !== stop; e = e.parentElement) {
    const st = getComputedStyle(e);
    if (st.visibility === "hidden" || st.display === "none") return 0;
    o *= parseFloat(st.opacity || "1");
    if (o < 0.02) return 0;
  }
  return o;
}
// (a word fades in on the span inside it)
const deepest = (el: Element) => {
  let e = el;
  while (e.firstElementChild) e = e.firstElementChild;
  return e;
};

function measure(root: HTMLElement, f: number, W: number): ProbeSample {
  const r0 = root.getBoundingClientRect();
  const k = r0.width / W || 1;
  const box = (r: DOMRect) => [Math.round((r.left - r0.left) / k), Math.round((r.top - r0.top) / k), Math.round(r.width / k), Math.round(r.height / k)] as const;
  const scope = root.parentElement ?? document.body;
  const words = new Map<string, ProbeWord>();
  for (const el of scope.querySelectorAll("[data-qa=word]")) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const key = el.getAttribute("data-key") ?? "";
    const o = Math.round(seen(deepest(el), scope) * 100) / 100;
    // (a trail draws a scene three times: the most visible one counts)
    if ((words.get(key)?.[5] ?? -1) >= o) continue;
    words.set(key, [key, ...box(r), o]);
  }
  const things = new Map<string, ProbeThing>();
  for (const el of scope.querySelectorAll("[data-qa=thing]")) {
    let r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    // (with its own words below it, where they reach past its box)
    for (const part of el.querySelectorAll("[data-qa-part]")) {
      const q = part.getBoundingClientRect();
      if (!q.width) continue;
      const x = Math.min(r.left, q.left), y = Math.min(r.top, q.top);
      r = new DOMRect(x, y, Math.max(r.right, q.right) - x, Math.max(r.bottom, q.bottom) - y);
    }
    const key = el.getAttribute("data-key") ?? "";
    const o = Math.round(seen(el, scope) * 100) / 100;
    if ((things.get(key)?.[5] ?? -1) >= o) continue;
    things.set(key, [key, ...box(r), o, el.getAttribute("data-kind") ?? "", el.getAttribute("data-title") ?? "", el.getAttribute("data-fly") ? 1 : 0]);
  }
  return { f, w: [...words.values()], t: [...things.values()] };
}

export function QaProbe({ W }: { W: number }) {
  const f = useCurrentFrame();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = delayRender(`frame check ${f}`);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      continueRender(h);
    };
    let raf = 0;
    // (once the faces are in and the frame is laid out)
    document.fonts.ready.then(() => {
      raf = requestAnimationFrame(() => {
        if (ref.current) console.log(PROBE_PREFIX + JSON.stringify(measure(ref.current, f, W)));
        finish();
      });
    }, finish);
    return () => {
      cancelAnimationFrame(raf);
      finish();
    };
  }, [f, W]);
  return <div ref={ref} style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />;
}
