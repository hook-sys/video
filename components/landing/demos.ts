// Demo videos for the landing gallery. Put each MP4 (with voice) in
// public/demos/ and set `src` (and optionally `poster`, a still image);
// a demo without `src` shows as "coming soon".
export type Demo = { title: string; industry: string; src: string | null; poster: string | null };

export const DEMOS: Demo[] = [
  { title: "Demo 1", industry: "SaaS", src: null, poster: null },
  { title: "Demo 2", industry: "SaaS", src: null, poster: null },
  { title: "Demo 3", industry: "SaaS", src: null, poster: null },
  { title: "Demo 4", industry: "SaaS", src: null, poster: null },
];
