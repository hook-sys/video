import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";
import { Sphere } from "./primitives";
import { AutoNext } from "./auto-next";
import { TypeText } from "./type-text";
import { Reveal, Words } from "./reveal";

// B · Add your brand — scattered UI fragments fly together into one screen.
const FRAGMENTS: { cls: string; from: string }[] = [
  { cls: "b-bar", from: "translate(-420px,-260px) rotate(-24deg)" },
  { cls: "b-side", from: "translate(-520px,120px) rotate(18deg)" },
  { cls: "b-heroblock", from: "translate(380px,-300px) rotate(22deg) scale(.7)" },
  { cls: "b-logo", from: "translate(520px,-40px) rotate(-30deg) scale(1.4)" },
  { cls: "b-shot b-shot-1", from: "translate(-300px,320px) rotate(-16deg)" },
  { cls: "b-shot b-shot-2", from: "translate(260px,340px) rotate(26deg)" },
  { cls: "b-shot b-shot-3", from: "translate(560px,260px) rotate(-12deg)" },
  { cls: "b-button", from: "translate(-560px,-60px) rotate(40deg)" },
];
export function SceneBrand() {
  return (
    <Reveal className="lp-light lp-b" sfx={[["typing", 200], ["whoosh", 1600], ["soft_pop", 2700]]}>
      <h2 className="lp-h2 lp-h2-dark">
        <Words text="Add your brand." />
      </h2>
      <div className="b-row">
        <div className="b-brief">
          <b>Write your brief</b>
          <p>
            <TypeText text="A 20 s promo for our booking app: busy clinics, one calendar, happy patients." />
          </p>
        </div>
        <span className="b-arrow" aria-hidden="true" />
        <div className="b-stage" aria-hidden="true">
          <div className="b-frame" />
          {FRAGMENTS.map((f, i) => (
            <span key={f.cls} className={`b-frag ${f.cls}`} style={{ "--from": f.from, "--i": i } as React.CSSProperties}>
              {f.cls === "b-logo" && <LogoMark size={34} />}
            </span>
          ))}
          <Sphere size={54} tone="pink" className="b-ball" />
        </div>
      </div>
      <AutoNext afterMs={3200} />
    </Reveal>
  );
}

// C · Every scene directed — floating glass panels on an isometric plane,
// wired together with light while a sphere rolls between them.
const PANELS = [
  { id: "scenes", label: "Scenes", icon: "M4 7h16v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 7l2-3h12l2 3M9 4l-2 3M15 4l-2 3" },
  { id: "voice", label: "Voice", icon: "M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3" },
  { id: "sound", label: "Sound", icon: "M9 18V6l10-2v12M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM19 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" },
];
export function SceneDirect() {
  return (
    <Reveal className="lp-lavender lp-c" sfx={[["digital_processing", 300], ["click", 900], ["click", 1150], ["click", 1400]]}>
      <div className="c-stage" aria-hidden="true">
        <div className="c-plane">
          <svg className="c-wires" viewBox="0 0 600 600">
            <path d="M300 300 L120 130" />
            <path d="M300 300 L480 150" />
            <path d="M300 300 L300 520" />
          </svg>
          <div className="c-panel c-core">
            <LogoMark size={44} />
            <b>Director</b>
          </div>
          {PANELS.map((p) => (
            <div key={p.id} className={`c-panel c-${p.id}`}>
              <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d={p.icon} />
              </svg>
              <b>{p.label}</b>
            </div>
          ))}
          <Sphere size={30} tone="violet" className="c-ball" />
        </div>
      </div>
      <h2 className="lp-h2 lp-h2-dark">
        <Words text="Every scene directed." />
        <br />
        <Words text="Every frame in motion." className="lp-grad-dark" delay={300} />
      </h2>
    </Reveal>
  );
}

// Closing: light rings expand over the brand gradient into the logo.
export function FinalCta({ signedIn }: { signedIn: boolean }) {
  return (
    <Reveal className="lp-final" sfx={[["reveal", 200]]}>
      <div className="f-rings" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <div className="f-lock">
        <LogoMark size={88} animated loopMs={6000} />
        <span className="f-word">MotionBrief</span>
      </div>
      <Link href={signedIn ? "/projects/new" : "/signup"} className="lp-btn lp-btn-light">
        {signedIn ? "Create video" : "Start free"}
      </Link>
    </Reveal>
  );
}
