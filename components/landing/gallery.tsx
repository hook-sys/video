"use client";

import { useRef } from "react";
import { DEMOS } from "./demos";
import { Reveal, Words } from "./reveal";

// Demo gallery: four promos made with MotionBrief, with their voice. Only one
// plays at a time.
export function Gallery() {
  const grid = useRef<HTMLDivElement>(null);
  const onPlay = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    grid.current?.querySelectorAll("video").forEach((v) => v !== e.currentTarget && v.pause());
  };
  return (
    <Reveal className="lp-dark lp-gallery" sfx={[["whoosh", 150]]}>
      <h2 className="lp-h2">
        <Words text="Made with MotionBrief." />
      </h2>
      <div ref={grid} className="g-grid">
        {DEMOS.map((d, i) => (
          <figure key={i} className="g-card" style={{ "--i": i } as React.CSSProperties}>
            {d.src ? (
              <video src={d.src} poster={d.poster ?? undefined} controls playsInline preload="metadata" onPlay={onPlay} />
            ) : (
              <div className="g-soon" aria-label={`${d.title}: coming soon`}>
                <span className="g-play" aria-hidden="true" />
                <span>Coming soon</span>
              </div>
            )}
            <figcaption>
              <b>{d.title}</b>
              <span>{d.industry}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </Reveal>
  );
}
