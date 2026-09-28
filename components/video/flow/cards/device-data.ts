// Device mockup and screenshot-crop data, kept free of React/Remotion so the
// server (Director validation, compiler) can import it.

export const DEVICE_MODELS = ["phone", "tablet", "laptop", "browser", "monitor", "watch"] as const;
export type DeviceModel = (typeof DEVICE_MODELS)[number];
export const DEVICE_FINISHES = ["light", "dark"] as const;
export type DeviceFinish = (typeof DEVICE_FINISHES)[number];

// Screen size (px) and frame padding per model.
export const DEVICE_SPEC: Record<DeviceModel, { w: number; h: number; pad: [number, number, number, number]; radius: number; description: string }> = {
  phone: { w: 360, h: 760, pad: [18, 18, 18, 18], radius: 56, description: "A smartphone, portrait" },
  tablet: { w: 760, h: 560, pad: [26, 26, 26, 26], radius: 40, description: "A tablet, landscape" },
  laptop: { w: 960, h: 600, pad: [22, 22, 60, 22], radius: 22, description: "A laptop with its base" },
  browser: { w: 1040, h: 640, pad: [52, 0, 0, 0], radius: 18, description: "A browser window with tabs bar" },
  monitor: { w: 1120, h: 640, pad: [22, 22, 22, 22], radius: 18, description: "A desktop monitor on a stand" },
  watch: { w: 220, h: 260, pad: [16, 16, 16, 16], radius: 60, description: "A smartwatch" },
};

export const deviceSize = (model: DeviceModel) => {
  const s = DEVICE_SPEC[model];
  return { w: s.w + s.pad[1] + s.pad[3], h: s.h + s.pad[0] + s.pad[2] + (model === "monitor" ? 90 : model === "laptop" ? 0 : 0) };
};

// Crop presets: which part of a screenshot a panel shows ([x, y, w, h] in 0..1).
const REGIONS: Record<string, [number, number]> = {
  "top-left": [0, 0],
  top: [0.5, 0],
  "top-right": [1, 0],
  left: [0, 0.5],
  center: [0.5, 0.5],
  right: [1, 0.5],
  "bottom-left": [0, 1],
  bottom: [0.5, 1],
  "bottom-right": [1, 1],
};
const ZOOMS: Record<string, number> = { wide: 0.75, half: 0.5, detail: 0.33 };
export const CROP_PRESETS: Record<string, [number, number, number, number]> = {
  full: [0, 0, 1, 1],
  ...Object.fromEntries(
    Object.entries(REGIONS).flatMap(([name, [ax, ay]]) =>
      Object.entries(ZOOMS).map(([zn, z]) => [`${name}-${zn}`, [ax * (1 - z), ay * (1 - z), z, z] as [number, number, number, number]]),
    ),
  ),
};
export const CROP_NAMES = Object.keys(CROP_PRESETS);
