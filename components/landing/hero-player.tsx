"use client";

import { Player, type PlayerRef } from "@remotion/player";
import { useEffect, useRef, useState } from "react";
import { ComposerFilm } from "@/components/video/composer/film";
import { FPS, type ComposerPlan, type ComposerProps } from "@/components/video/composer/types";
import type { HeroCaption } from "./hero-plan";
import { useSound } from "./sound";

// MotionBrief's own promo, looping, made with its Composer. Muted unless
// the page's sound is on; the caption line changes on the frame its words
// start.
export function HeroPlayer({ plan, captions }: { plan: ComposerPlan; captions: HeroCaption[] }) {
  const ref = useRef<PlayerRef>(null);
  const [line, setLine] = useState(0);
  const { on } = useSound();

  useEffect(() => {
    const player = ref.current;
    if (!player) return;
    if (on) {
      player.unmute();
      player.seekTo(0);
      player.play();
    } else player.mute();
  }, [on]);

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

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <p key={line} className="hero-caption h-7 text-center text-lg font-semibold tracking-tight text-white/90 sm:text-xl">
        {captions[line]?.text}
      </p>
      <div className="relative w-full overflow-hidden rounded-2xl shadow-2xl shadow-indigo-900/50 ring-1 ring-white/25">
        <Player
          ref={ref}
          component={ComposerFilm}
          inputProps={{ plan } satisfies ComposerProps}
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
      </div>
    </div>
  );
}
