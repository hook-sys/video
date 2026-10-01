// A CSS blur for a whole element and everything in it. The download renderer
// (@remotion/web-renderer) only blurs a subtree as one image when the filter
// has a drop-shadow; a transparent one draws nothing in the Preview and gives
// the download room for the blur's spread.
export const blurFilter = (px: number) => `blur(${px}px) drop-shadow(0 0 ${px}px transparent)`;
