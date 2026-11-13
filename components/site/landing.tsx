"use client";

import Link from "next/link";
import { type MouseEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { DEMOS } from "@/components/landing/demos";
import "./landing.css";

// The landing page (/): one long page, read top to bottom — what it does (a video
// playing beside the words), why it reads (the picture is the word said), how
// (three steps), the five looks, examples, the price, and once more the start.
// Everything comes in as it scrolls into view, rising, one after another; the
// numbers count up; what can be pressed lifts and glows. Nothing moves for a
// reader who asks for less motion.

type Go = (e: MouseEvent<HTMLAnchorElement>) => void;

// comes in as it scrolls into view (once), `delay` ms after the ones before it
function Reveal({ children, delay = 0, className = "", as = "div" }: { children: ReactNode; delay?: number; className?: string; as?: "div" | "section" | "li" }) {
  const ref = useRef<HTMLElement | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (setSeen(true), io.disconnect()), { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const Tag = as;
  return (
    <Tag ref={ref as never} className={`ld-reveal${seen ? " in" : ""} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </Tag>
  );
}

// a number counting up once it is in view
function Count({ to, suffix = "" }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const step = (t: number) => {
        const k = Math.min(1, (t - t0) / 1100);
        setN(Math.round(to * (1 - Math.pow(1 - k, 3))));
        if (k < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    });
    io.observe(el);
    return () => (io.disconnect(), cancelAnimationFrame(raf));
  }, [to]);
  return (
    <span ref={ref}>
      {n}
      {suffix}
    </span>
  );
}

// the few pictures the page draws (lines, 24 × 24)
const ICON: Record<string, ReactNode> = {
  person: <><circle cx="12" cy="8" r="4" /><path d="M5 20a7 7 0 0 1 14 0" /></>,
  people: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 20a6.5 6.5 0 0 0-2.5-5.1" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  truck: <><path d="M3 6h11v10H3zM14 9h4l3 3v4h-7z" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></>,
  pin: <><path d="M12 22s7-6.1 7-12a7 7 0 0 0-14 0c0 5.9 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></>,
  chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
  cart: <><circle cx="9" cy="20" r="1.5" /><circle cx="18" cy="20" r="1.5" /><path d="M2 3h3l3 12h11l2-8H6.5" /></>,
  megaphone: <><path d="M3 11v2a1 1 0 0 0 1 1h3l6 4V6L7 10H4a1 1 0 0 0-1 1zM17 9a4 4 0 0 1 0 6" /></>,
  play: <path d="M7 4v16l13-8z" />,
  mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>,
  wand: <><path d="M4 20 16 8M14 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1zM19 11l.7 1.3 1.3.7-1.3.7-.7 1.3-.7-1.3-1.3-.7 1.3-.7z" /></>,
  download: <><path d="M12 3v12M7 10l5 5 5-5M4 21h16" /></>,
};
const Svg = ({ name, size = 22 }: { name: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {ICON[name]}
  </svg>
);

// the hero's video: a panel's rows coming in one by one, as a voice would say them, on a loop
const ROWS: [string, string, string][] = [
  ["অডিয়েন্স", "people", "#7c3aed"],
  ["বয়স", "person", "#3b82f6"],
  ["এলাকা", "pin", "#f97316"],
  ["দিনের সময়", "sun", "#059669"],
];
function HeroVideo() {
  return (
    <div className="ld-video" aria-label="A MotionDots video playing">
      <div className="ld-screen">
        <div className="ld-dots-bg" />
        <div className="ld-panel">
          {ROWS.map(([text, icon, col], i) => (
            <div key={text} className="ld-row" style={{ animationDelay: `${0.4 + i * 0.9}s` }}>
              <span className="ld-tile" style={{ background: `linear-gradient(160deg, ${col}aa, ${col})` }}>
                <Svg name={icon} size={20} />
              </span>
              <b>{text}</b>
              <span className="ld-mini" style={{ ["--c" as string]: col }}>
                <i />
                <i />
                <i />
                <i />
              </span>
            </div>
          ))}
        </div>
        <p className="ld-caption">
          <span className="key">দিনের</span> কোন সময় বেশি
        </p>
      </div>
      <div className="ld-bar">
        <span className="ld-playbtn">
          <Svg name="play" size={14} />
        </span>
        <span className="ld-track">
          <i />
        </span>
        <span className="ld-time">0:24</span>
      </div>
    </div>
  );
}

// the five looks, each drawn in its own way
const LOOKS: [string, string, string][] = [
  ["Soft", "ld-look-soft", "Frosted glass, rounded, calm"],
  ["Neon", "ld-look-neon", "Glowing edges on deep dark"],
  ["Editorial", "ld-look-ed", "Paper, ink lines, a serif"],
  ["Bold", "ld-look-bold", "Thick outlines, hard shadows"],
  ["Depth", "ld-look-depth", "Deep shadows, a slow 3D turn"],
];

export function Landing({ signedIn, start, examples, focus }: { signedIn: boolean; start: Go; examples: string; focus?: string }) {
  // (a place on it chosen in the menu: scrolled to)
  useEffect(() => {
    if (focus === "how" || focus === "examples") document.getElementById(focus)?.scrollIntoView({ behavior: "smooth", block: "start" });
    else if (focus === "overview") window.scrollTo({ top: 0, behavior: "smooth" });
  }, [focus]);
  const startBtn = (label: string, big = true) =>
    signedIn ? (
      <Link href="/projects/new" className={`gs-btn${big ? " big" : ""}`}>
        {label === "Start free" ? "Create a video" : label}
      </Link>
    ) : (
      <Link href="/signup" className={`gs-btn${big ? " big" : ""}`} onClick={start}>
        {label}
      </Link>
    );
  return (
    <div className="ld">
      {/* ── the hero ── */}
      <section className="ld-hero">
        <div className="ld-hero-words">
          <Reveal>
            <span className="ld-pill">
              <i /> 131 designs · Bangla and English voice
            </span>
          </Reveal>
          <Reveal delay={80}>
            <h1>
              Your script, turned into a <span className="ld-grad">motion video</span>
              <span className="ld-blink" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="ld-lead">Type what you want to say. MotionDots reads it in a natural voice and moves every word on screen — the icons, cards and charts match what is said, the moment it is said.</p>
          </Reveal>
          <Reveal delay={240} className="ld-ctas">
            {startBtn("Start free")}
            <a href={examples} className="gs-btn ghost big">
              See it move
            </a>
          </Reveal>
          <Reveal delay={320}>
            <p className="ld-small">First video free · no editing · pay only for what you make</p>
          </Reveal>
        </div>
        <Reveal delay={200} className="ld-hero-video">
          <HeroVideo />
        </Reveal>
      </section>

      {/* ── the numbers ── */}
      <section className="ld-stats">
        {[
          [131, "", "designs, chosen for every scene"],
          [5, "", "looks for the whole video"],
          [7, "", "ways from scene to scene"],
          [2, " min", "from script to video"],
        ].map(([n, suf, label], i) => (
          <Reveal key={String(label)} delay={i * 90} className="ld-stat">
            <b>
              <Count to={Number(n)} suffix={String(suf)} />
            </b>
            <span>{label}</span>
          </Reveal>
        ))}
      </section>

      {/* ── the picture is the word said ── */}
      <section className="ld-section">
        <Reveal>
          <h2>
            The picture is <span className="ld-grad">the word said.</span>
          </h2>
          <p className="ld-lead">Say “বয়স” and a person comes in. Say “ডেলিভারি” and a truck drives in. Every icon comes from a word in the voice, right when it is spoken — never a guess.</p>
        </Reveal>
        <div className="ld-words">
          {[
            ["বয়স", "person"],
            ["অডিয়েন্স", "people"],
            ["দিনের", "sun"],
            ["ডেলিভারি", "truck"],
            ["এলাকা", "pin"],
            ["রিপোর্ট", "chart"],
            ["কার্ট", "cart"],
            ["ক্যাম্পেইন", "megaphone"],
          ].map(([w, icon], i) => (
            <Reveal key={w} delay={i * 70} className="ld-word">
              <span className="ld-word-icon">
                <Svg name={icon} size={26} />
              </span>
              <b>{w}</b>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── how ── */}
      <section className="ld-section" id="how">
        <Reveal>
          <h2>
            Three steps. <span className="ld-grad">No editing.</span>
          </h2>
        </Reveal>
        <div className="ld-steps">
          {[
            ["mic", "Write your script", "Exactly what the voice should say — or upload your own recording. Pick your brand once; it is saved for next time."],
            ["wand", "We voice and animate it", "A natural voice reads it. Every scene is drawn for its words: cards, charts, icons, all in your colour."],
            ["download", "Watch, tweak, download", "Change any scene's design in a click. Download an MP4 — wide, tall or square."],
          ].map(([icon, title, text], i) => (
            <Reveal key={title} delay={i * 120} className="ld-step">
              <span className="ld-step-n">{i + 1}</span>
              <span className="ld-step-icon">
                <Svg name={icon} size={24} />
              </span>
              <b>{title}</b>
              <p>{text}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── the looks ── */}
      <section className="ld-section">
        <Reveal>
          <h2>
            Five looks. <span className="ld-grad">Never the same video twice.</span>
          </h2>
          <p className="ld-lead">Each video gets its own look, its own type and its own way between scenes — different from your last five, every time.</p>
        </Reveal>
        <div className="ld-looks">
          {LOOKS.map(([name, cls, text], i) => (
            <Reveal key={name} delay={i * 80} className={`ld-look ${cls}`}>
              <div className="ld-look-card">
                <span className="ld-look-tile" />
                <span className="ld-look-line" />
                <span className="ld-look-line short" />
              </div>
              <b>{name}</b>
              <span>{text}</span>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── examples ── */}
      <section className="ld-section" id="examples">
        <Reveal>
          <h2>
            Made with <span className="ld-grad">MotionDots.</span>
          </h2>
        </Reveal>
        <div className="ld-examples">
          {DEMOS.map((d, i) => (
            <Reveal key={i} delay={i * 90} className="ld-example">
              {d.src ? <video src={d.src} poster={d.poster ?? undefined} controls playsInline preload="metadata" /> : <div className="ld-soon"><HeroMini i={i} /></div>}
              <div className="ld-example-cap">
                <b>{d.title}</b>
                <span>{d.industry}</span>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── the price ── */}
      <section className="ld-section">
        <Reveal className="ld-price">
          <div>
            <h2>
              Pay only for <span className="ld-grad">what you make.</span>
            </h2>
            <p className="ld-lead">No subscription. Load credits with bKash, Nagad or Rocket and use them when you like. Credits never expire.</p>
            {startBtn("Start free")}
          </div>
          <ul className="ld-price-list">
            {[
              ["Up to 20 seconds", "30 credits"],
              ["30 seconds", "40 credits"],
              ["60 seconds", "70 credits"],
              ["Your first edit", "free"],
            ].map(([a, b]) => (
              <li key={a}>
                <span>{a}</span>
                <b>{b}</b>
              </li>
            ))}
          </ul>
        </Reveal>
      </section>

      {/* ── once more ── */}
      <section className="ld-section">
        <Reveal className="ld-final">
          <div className="ld-final-dots" aria-hidden="true" />
          <h2>Your first video, in two minutes.</h2>
          <p>Write it. Watch it move.</p>
          {signedIn ? (
            <Link href="/projects/new" className="gs-btn big ld-white">
              Create a video
            </Link>
          ) : (
            <Link href="/signup" className="gs-btn big ld-white" onClick={start}>
              Start free
            </Link>
          )}
        </Reveal>
      </section>
    </div>
  );
}

// a small moving card for an example still to come
function HeroMini({ i }: { i: number }) {
  const [, icon, col] = ROWS[i % ROWS.length];
  return (
    <div className="ld-mini-card" style={{ ["--c" as string]: col }}>
      <span className="ld-tile" style={{ background: `linear-gradient(160deg, ${col}aa, ${col})` }}>
        <Svg name={icon} size={18} />
      </span>
      <em>Coming soon</em>
    </div>
  );
}
