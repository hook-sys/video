import type { ReactNode } from "react";
import { Img } from "remotion";
import { H, W } from "../frame";
import { Glass, Parallax, cam2d } from "../fake2d";
import { kIn, type Ctx } from "../kit";
import { clamp01 } from "../motion";
import type { CameraKind, Word } from "../types";
import { Atmosphere } from "./atmosphere";
import { fitType, saidAt, stageOf, type Rect } from "./stage";
import type { ResolvedHero } from "./slots";

// The last scene: the uploaded mark, the real brand name, and the ask.
// No letter tile. Glows, an orbit and a cursor keep the frame moving, and
// the camera is clamped so the type stays inside.
export function LogoEnd({ hero, camera, c, words, from, to, si }: { hero: ResolvedHero; camera: CameraKind; c: Ctx; words: Word[]; from: number; to: number; si: number }) {
  const p = clamp01((c.f - from) / Math.max(1, to - from));
  const cam = cam2d(camera, p, c.f, c.art.energy);
  const { main, alt } = stageOf(hero.layout);
  const name = hero.slots.brandName ?? c.brand.name;
  const sheen = (c.f % 52) / 52;
  const air = () => <Atmosphere c={c} variant={hero.variant} />;
  return (
    <Parallax
      cam={cam}
      textBox={union(main, alt)}
      back={air()}
      mid={<Rings f={c.f} variant={hero.variant} color={c.pal.fill} />}
      front={alt ? (
        <>
          <Pane c={c} rect={main} sheen={sheen} si={si} title={name} backdrop={air()}>
            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Mark c={c} from={from} stagger={hero.stagger} box={main} />
            </div>
          </Pane>
          <Pane c={c} rect={alt} sheen={sheen} si={si} title={name} backdrop={air()}>
            <Copy c={c} hero={hero} words={words} from={from} to={to} rect={alt} si={si} name={name} />
          </Pane>
        </>
      ) : (
        <Pane c={c} rect={main} sheen={sheen} si={si} title={name} backdrop={air()}>
          <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: Math.round(main.h * 0.04), textAlign: "center" }}>
            <Mark c={c} from={from} stagger={hero.stagger} box={main} />
            <Copy c={c} hero={hero} words={words} from={from} to={to} rect={main} si={si} name={name} />
          </div>
        </Pane>
      )}
    />
  );
}

function union(a: Rect, b: Rect | null): Rect {
  if (!b) return a;
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

function Pane({ c, rect, sheen, si, title, backdrop, children }: { c: Ctx; rect: Rect; sheen: number; si: number; title: string; backdrop?: ReactNode; children: ReactNode }) {
  const fill = c.pal.dark ? "rgba(16,16,22,0.42)" : "rgba(255,255,255,0.42)";
  return (
    <Glass x={rect.x} y={rect.y} w={rect.w} h={rect.h} radius={Math.min(36, (c.art.radius || 16) + 12)} fill={fill} sheen={sheen} backdrop={backdrop}>
      <div data-qa="thing" data-key={`${si}:logo:${title}:${Math.round(rect.x)}:${Math.round(rect.y)}`} data-kind="logo" data-title={title} data-scene={si} style={{ width: "100%", height: "100%" }}>
        {children}
      </div>
    </Glass>
  );
}

function Mark({ c, from, stagger, box }: { c: Ctx; from: number; stagger: ResolvedHero["stagger"]; box: Rect }) {
  const k = kIn(c, from + 2, 16);
  const s = Math.round(Math.min(220, Math.max(96, Math.min(box.w, box.h) * 0.34)));
  const pop = stagger === "pop" ? 0.84 + 0.16 * clamp01(k) : 1;
  const breathe = 1 + Math.sin(c.f / 24) * 0.012;
  if (!c.brand.icon) return null;
  return <Img src={c.brand.icon} style={{ width: s, height: s, objectFit: "contain", opacity: clamp01(k * 1.4), transform: `scale(${(pop * breathe).toFixed(4)})` }} />;
}

function Copy({ c, hero, words, from, to, rect, si, name }: { c: Ctx; hero: ResolvedHero; words: Word[]; from: number; to: number; rect: Rect; si: number; name: string }) {
  const step = hero.stagger === "pop" ? 2 : hero.stagger === "slide" ? 6 : 8;
  const nameK = kIn(c, from + step, 14);
  const tag = hero.slots.tagline;
  const cta = hero.slots.cta;
  const tagK = tag ? kIn(c, saidAt(words, tag.from, from + step * 2), 14) : 0;
  const ctaAt = saidAt(words, cta?.from ?? null, from + step * 3);
  const ctaK = cta ? kIn(c, ctaAt, 14) : 0;
  const cap = Math.round(Math.min(rect.w * 0.16, rect.h * 0.18, 96));
  const nameSize = fitType(name, rect.w - 80, cap, 34);
  const slide = hero.stagger === "slide" ? 28 : 0;
  const click = Math.min(to - 18, ctaAt + 18);
  const near = clamp01(1 - Math.abs(c.f - click) / 6);
  const press = cta ? 1 - 0.06 * Math.sin(near * Math.PI) : 1;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: Math.round(Math.min(28, rect.h * 0.035)), width: "100%", height: "100%", padding: "8% 8%", textAlign: "center", position: "relative" }}>
      <div style={{ fontFamily: c.display, fontWeight: c.art.weight, fontSize: nameSize, letterSpacing: "-0.03em", lineHeight: 1.02, color: c.pal.panelInk, opacity: clamp01(nameK * 1.3), transform: `translateY(${((1 - clamp01(nameK)) * slide).toFixed(1)}px)` }}>
        {name.split(" ").map((w, i) => (
          <span key={i} data-qa="word" data-key={`${si}:w${i}`} style={{ display: "inline-block", marginRight: "0.22em" }}>{w}</span>
        ))}
      </div>
      {tag && (
        <div style={{ fontFamily: c.text, fontSize: Math.max(18, Math.round(nameSize * 0.34)), fontWeight: 500, color: c.pal.panelSub, maxWidth: "94%", lineHeight: 1.25, opacity: clamp01(tagK * 1.3), transform: `translateY(${((1 - clamp01(tagK)) * slide).toFixed(1)}px)` }}>
          {tag.text}
        </div>
      )}
      {cta && (
        <div style={{ marginTop: 4, opacity: clamp01(ctaK * 1.4), transform: `translateY(${((1 - clamp01(ctaK)) * 18).toFixed(1)}px) scale(${press.toFixed(3)})` }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "14px 26px", borderRadius: 999, background: `linear-gradient(100deg, ${c.pal.fill}, ${c.pal.fill2})`, color: c.pal.onFill, fontFamily: c.text, fontWeight: 700, fontSize: Math.max(20, Math.round(nameSize * 0.36)), boxShadow: `0 16px 34px ${c.pal.fill}44` }}>
            <span data-qa="word" data-key={`${si}:cta`}>{cta.text}</span>
            <span aria-hidden>→</span>
          </div>
        </div>
      )}
      {cta && <Cursor c={c} from={ctaAt} click={click} />}
    </div>
  );
}

function Cursor({ c, from, click }: { c: Ctx; from: number; click: number }) {
  const s = Math.round(Math.min(W, H) * 0.072);
  const t = clamp01((c.f - from) / Math.max(8, click - from));
  const x = 12 + t * 42;
  const y = 58 - t * 22 - Math.sin(t * Math.PI) * 8;
  const since = c.f - click;
  const ring = since >= 0 ? (since % 36) / 36 : -1;
  return (
    <div style={{ position: "absolute", left: `${x}%`, top: `${y}%`, width: s, height: s, opacity: clamp01((c.f - from) / 6) }}>
      <svg width={s} height={s} viewBox="0 0 24 24">
        <path d="M5 3 L5 19.5 L9.4 15.1 L12.6 21.2 L15 20 L11.8 13.8 L17.2 13.6 Z" fill="#141414" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
      {ring >= 0 && <div style={{ position: "absolute", left: s * 0.2, top: s * 0.15, width: s * 0.55, height: s * 0.55, borderRadius: s, border: `3px solid ${c.pal.fill}`, opacity: 1 - ring, transform: `scale(${(0.45 + ring * 1.5).toFixed(3)})` }} />}
    </div>
  );
}

function Rings({ f, variant, color }: { f: number; variant: number; color: string }) {
  return (
    <>
      {[0.28, 0.4, 0.52].map((k, i) => {
        const spin = ((f / (90 + i * 20) + variant * 0.2) % 1) * 36 - 18;
        const rx = W * k;
        const ry = H * k * 0.72;
        return <div key={i} style={{ position: "absolute", left: W / 2 - rx, top: H / 2 - ry, width: rx * 2, height: ry * 2, borderRadius: "50%", border: `1.5px solid ${color}`, opacity: 0.28, transform: `rotate(${spin.toFixed(2)}deg)` }} />;
      })}
    </>
  );
}
