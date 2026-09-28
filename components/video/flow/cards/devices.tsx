import type { ReactNode } from "react";
import { Img } from "remotion";

// Device mockups (a screen inside a frame) and screenshot crops, so the
// customer's real screenshots appear as layered product panels rather than
// one flat picture.

import { CROP_PRESETS, DEVICE_SPEC, type DeviceFinish, type DeviceModel } from "./device-data";

export * from "./device-data";

// A screenshot region filling its box.
export function Crop({ src, crop = "full", w, h }: { src: string; crop?: string; w: number; h: number }) {
  const [x, y, cw, ch] = CROP_PRESETS[crop] ?? CROP_PRESETS.full;
  return (
    <div style={{ width: w, height: h, overflow: "hidden", position: "relative" }}>
      <Img src={src} style={{ position: "absolute", width: w / cw, height: h / ch, left: (-x * w) / cw, top: (-y * h) / ch, objectFit: "cover", objectPosition: "top left" }} />
    </div>
  );
}

// A device with any screen content (a screenshot crop, a card, …).
export function Device({ model, finish = "light", children }: { model: DeviceModel; finish?: DeviceFinish; children: ReactNode }) {
  const s = DEVICE_SPEC[model];
  const [pt, pr, pb, pl] = s.pad;
  const frame = finish === "dark" ? "linear-gradient(160deg, #2A2D36, #121318)" : "linear-gradient(160deg, #F4F5F8, #D9DCE3)";
  const edge = finish === "dark" ? "rgba(255,255,255,.12)" : "rgba(255,255,255,.9)";
  const screen = (
    <div style={{ position: "absolute", left: pl, top: pt, width: s.w, height: s.h, borderRadius: Math.max(8, s.radius - 14), overflow: "hidden", background: "#fff" }}>
      {children}
    </div>
  );
  if (model === "browser")
    return (
      <div style={{ position: "relative", width: s.w, height: s.h + pt, borderRadius: s.radius, overflow: "hidden", background: finish === "dark" ? "#1B1D24" : "#FFFFFF", boxShadow: "0 40px 90px rgba(15,23,42,.22), inset 0 0 0 1px rgba(15,23,42,.08)" }}>
        <div style={{ position: "absolute", left: 0, top: 0, right: 0, height: pt, display: "flex", alignItems: "center", gap: 8, padding: "0 20px", background: finish === "dark" ? "#24262E" : "#F3F4F7" }}>
          {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => <div key={c} style={{ width: 13, height: 13, borderRadius: 7, background: c }} />)}
          <div style={{ marginLeft: 18, height: 26, flex: 1, maxWidth: 420, borderRadius: 13, background: finish === "dark" ? "#16181E" : "#FFFFFF" }} />
        </div>
        <div style={{ position: "absolute", left: 0, top: pt, width: s.w, height: s.h, overflow: "hidden" }}>{children}</div>
      </div>
    );
  return (
    <div style={{ position: "relative", width: s.w + pl + pr, height: s.h + pt + pb + (model === "monitor" ? 90 : 0) }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: s.w + pl + pr, height: s.h + pt + pb, borderRadius: s.radius, background: frame, boxShadow: `0 40px 90px rgba(15,23,42,.25), inset 0 0 0 2px ${edge}` }} />
      {screen}
      {model === "phone" && <div style={{ position: "absolute", left: pl + s.w / 2 - 50, top: pt + 12, width: 100, height: 26, borderRadius: 13, background: "#0B0C10" }} />}
      {model === "laptop" && <div style={{ position: "absolute", left: -60, top: s.h + pt + pb - 14, width: s.w + pl + pr + 120, height: 20, borderRadius: "0 0 18px 18px", background: finish === "dark" ? "#1A1C22" : "#C9CDD6" }} />}
      {model === "monitor" && (
        <>
          <div style={{ position: "absolute", left: (s.w + pl + pr) / 2 - 40, top: s.h + pt + pb, width: 80, height: 70, background: finish === "dark" ? "#22242B" : "#D3D6DE" }} />
          <div style={{ position: "absolute", left: (s.w + pl + pr) / 2 - 150, top: s.h + pt + pb + 70, width: 300, height: 20, borderRadius: 10, background: finish === "dark" ? "#22242B" : "#D3D6DE" }} />
        </>
      )}
    </div>
  );
}
