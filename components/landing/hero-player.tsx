"use client";

import { Player, type PlayerRef } from "@remotion/player";
import { useEffect, useRef, useState } from "react";
import { FlowScene, type FlowSceneProps } from "@/components/video/flow/flow-scene";
import type { FlowPlan } from "@/components/video/flow/types";
import { FPS } from "@/components/video/types";
import type { HeroCaption } from "./hero-plan";

// The landing hero: MotionBrief's own promo, looping. Browsers only allow
// sound after a click, so it starts muted with a sound toggle; the caption
// line changes on the frame its words start.
export function HeroPlayer({ plan, captions }: { plan: FlowPlan; captions: HeroCaption[] }) {
  const ref = useRef<PlayerRef>(null);
  const [line, setLine] = useState(0);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const player = ref.current;
    if (!player) return;
    const onFrame = (e: { detail: { frame: number } }) => {
      let i = 0;
      captions.forEach((c, k) => {
        if (e.detail.frame >= c.frame) i = k;
      });
      setLine(i);
    };
    player.addEventListener("frameupdate", onFrame);
    return () => player.removeEventListener("frameupdate", onFrame);
  }, [captions]);

  const toggleSound = () => {
    const player = ref.current;
    if (!player) return;
    if (muted) {
      player.unmute();
      player.seekTo(0);
      player.play();
    } else player.mute();
    setMuted(!muted);
  };

  return (
    <div className="flex w-full flex-col items-center gap-5">
      <p key={line} className="hero-caption h-8 text-center text-xl font-medium tracking-tight text-foreground/80 sm:text-2xl">
        {captions[line]?.text}
      </p>
      <div className="relative w-full overflow-hidden rounded-2xl shadow-2xl shadow-violet-500/20 ring-1 ring-foreground/10">
        <Player
          ref={ref}
          component={FlowScene}
          inputProps={{ plan } satisfies FlowSceneProps}
          durationInFrames={plan.duration}
          fps={FPS}
          compositionWidth={1920}
          compositionHeight={1080}
          autoPlay
          loop
          initiallyMuted
          numberOfSharedAudioTags={20}
          style={{ width: "100%", aspectRatio: "16 / 9" }}
        />
        <button
          type="button"
          onClick={toggleSound}
          className="absolute right-3 bottom-3 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur transition hover:bg-black/75"
          aria-label={muted ? "Turn sound on" : "Turn sound off"}
        >
          {muted ? "🔇 Sound on" : "🔊 Sound off"}
        </button>
      </div>
    </div>
  );
}
