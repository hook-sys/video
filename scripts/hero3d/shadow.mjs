import sharp from "sharp";

// Fades the contact shadow out radially so it never reaches the frame edge
// (the ground plane is wider than the frame; a cut shadow can't be composited).
export async function fadeShadow(img, size) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><defs><radialGradient id="g" cx="50%" cy="50%" r="50%"><stop offset="0.72" stop-color="#fff" stop-opacity="1"/><stop offset="0.97" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`;
  const buf = await img.png().toBuffer();
  return sharp(buf).composite([{ input: Buffer.from(svg), blend: "dest-in" }]);
}
