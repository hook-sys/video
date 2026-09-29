// Scene backdrops the Director can choose (rendered by backdrops.tsx behind
// the elements, over the drifting colour mesh). Kept free of React so the
// script schema can import it.
export const BACKDROPS = [
  "mesh", // only the soft colour mesh (default)
  "particles", // tiny lights drifting upward
  "dot-field", // a grid of dots with a ripple of light running through it
  "grid", // a fine blueprint grid
  "perspective-grid", // a floor grid receding into the distance, moving forward
  "light-beams", // soft diagonal beams sweeping across
  "rings", // concentric rings pulsing out from the centre
  "waves", // flowing sine lines
  "glow", // a large central glow breathing, darker edges
  "data-stream", // columns of small dashes streaming down
  "blobs", // liquid colour blobs morphing
  "grain", // a fine film grain over the mesh
  "energy", // curved trails of light sweeping through the frame
  "spotlight", // a swaying stage light from above, the rest in shade
  "horizon", // a bright horizon line with a glow rising behind it
  "aurora", // soft curtains of colour drifting across the top
] as const;
export type BackdropName = (typeof BACKDROPS)[number];
export const isBackdrop = (x: unknown): x is BackdropName => typeof x === "string" && (BACKDROPS as readonly string[]).includes(x);
