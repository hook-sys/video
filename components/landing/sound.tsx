"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

// Landing sounds: off until the visitor turns them on (browsers block audio
// before a click). Scenes call play() as they come into view.
type Sfx = "whoosh" | "soft_pop" | "click" | "reveal" | "success_chime" | "subtle_impact" | "digital_processing" | "typing";
const SoundContext = createContext<{ on: boolean; toggle: () => void; play: (s: Sfx) => void }>({ on: false, toggle: () => {}, play: () => {} });

export function SoundProvider({ children }: { children: React.ReactNode }) {
  const [on, setOn] = useState(false);
  const onRef = useRef(false);
  const play = useCallback((s: Sfx) => {
    if (!onRef.current) return;
    const a = new Audio(`/sfx/${s}.mp3`);
    a.volume = 0.35;
    void a.play().catch(() => {});
  }, []);
  const toggle = useCallback(() => {
    onRef.current = !onRef.current;
    setOn(onRef.current);
    if (onRef.current) {
      const a = new Audio("/sfx/soft_pop.mp3");
      a.volume = 0.35;
      void a.play().catch(() => {});
    }
  }, []);
  return <SoundContext.Provider value={{ on, toggle, play }}>{children}</SoundContext.Provider>;
}

export const useSound = () => useContext(SoundContext);

export function SoundToggle() {
  const { on, toggle } = useSound();
  return (
    <button type="button" onClick={toggle} className="lp-sound" aria-pressed={on} aria-label={on ? "Turn sound off" : "Turn sound on"}>
      <span className={`lp-sound-bars ${on ? "is-on" : ""}`} aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      {on ? "Sound on" : "Sound off"}
    </button>
  );
}
