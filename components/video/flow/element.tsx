import { Img } from "remotion";
import { Icon } from "@/components/video/icons";
import { Card } from "./cards/card";
import { Crop, Device, DEVICE_SPEC, type DeviceFinish, type DeviceModel } from "./cards/devices";
import { CARD_BY_ID } from "./cards/templates";
import { ShapeObject, TextObject, VisualObject } from "./shapes";
import type { CardContent, CardStyle } from "./cards/types";
import { num, ramp } from "./eval";
import type { NodeState } from "./states";
import type { FlowTheme } from "./themes";
import type { Track, Vec3 } from "./types";

// Renders an element node ("el"): a card, device, screenshot crop, glass icon
// tile or logo, centred on its position, with 3D tilt, rotation, depth blur
// and an erase sweep.

function tiltAt(track: Track<Vec3> | undefined, frame: number): Vec3 {
  if (!track?.length) return [0, 0, 0];
  return [0, 1, 2].map((i) => num(track.map(([t, v, e]) => [t, v[i], e]), frame, 0)) as Vec3;
}

export function ElementView({ s, frame, theme, calm }: { s: NodeState; frame: number; theme: FlowTheme; calm?: boolean }) {
  const { node, pos, scale, opacity } = s;
  const el = node.el!;
  if (scale < 0.01 || opacity < 0.01) return null;
  const w = node.w ?? 400;
  const h = node.h ?? 300;
  const [rx, ry, rz] = tiltAt(node.tilt, frame);
  const rot = num(node.rot, frame, 0);
  const blur = num(node.blur, frame, 0);
  const t = frame - (node.appear ?? 0);
  const erase = node.erase !== undefined ? ramp(frame, node.erase, 16, "inOut") : 0;
  if (erase >= 1) return null;

  let body: React.ReactNode = null;
  if (el.type === "card") {
    const tpl = CARD_BY_ID.get(el.template);
    if (tpl) {
      const upd = [...(el.updates ?? [])].reverse().find((u) => frame >= u.at);
      const content = { ...(el.content ?? {}), ...(upd?.content ?? {}) } as CardContent;
      body = <Card tpl={tpl} content={content} style={el.style as CardStyle} theme={theme} t={upd ? frame - upd.at + 12 : t} />;
    }
  } else if (el.type === "device") {
    const spec = DEVICE_SPEC[el.model as DeviceModel] ?? DEVICE_SPEC.laptop;
    const inner = el.screen.card && CARD_BY_ID.get(el.screen.card.template);
    body = (
      <Device model={el.model as DeviceModel} finish={el.finish as DeviceFinish}>
        {el.screen.src ? (
          <Crop src={el.screen.src} crop={el.screen.crop} w={spec.w} h={spec.h} />
        ) : inner ? (
          // The card fills the screen's width (tall screens: from the top, like an app).
          <div style={{ width: spec.w, height: spec.h, display: "flex", alignItems: spec.h > spec.w ? "flex-start" : "center", justifyContent: "center", paddingTop: spec.h > spec.w ? 56 : 0, boxSizing: "border-box", background: theme.soft, overflow: "hidden" }}>
            <div style={{ transform: `scale(${Math.min(1.2, (spec.w - 24) / inner.w)})`, transformOrigin: spec.h > spec.w ? "top center" : "center" }}>
              <Card tpl={inner} content={el.screen.card!.content as CardContent} style={el.screen.card!.style as CardStyle} theme={theme} t={t} />
            </div>
          </div>
        ) : (
          <div style={{ width: spec.w, height: spec.h, background: `linear-gradient(160deg, ${theme.soft}, #fff)` }} />
        )}
      </Device>
    );
  } else if (el.type === "shot") {
    body = (
      <div style={{ width: w, height: h, borderRadius: 22, overflow: "hidden", boxShadow: `0 30px 70px ${theme.glow}0.22), inset 0 0 0 1.5px rgba(255,255,255,.9)`, background: "#fff" }}>
        <Crop src={el.src} crop={el.crop} w={w} h={h} />
      </div>
    );
  } else if (el.type === "icon") {
    body = (
      <div style={{ width: w, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <div style={{ width: w, height: w, borderRadius: w * 0.26, background: theme.dark ? "linear-gradient(160deg, rgba(255,255,255,.12), rgba(255,255,255,.03))" : "linear-gradient(160deg, rgba(255,255,255,.96), rgba(255,255,255,.72))", boxShadow: `0 ${w * 0.12}px ${w * 0.36}px ${theme.glow}0.18), inset 0 0 0 1.5px rgba(255,255,255,.9)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name={el.icon} size={w * 0.44} color={theme.primary} strokeWidth={2} draw={ramp(t, 2, 16, "inOut")} />
        </div>
        {el.label && <div style={{ fontSize: Math.max(22, w * 0.2), fontWeight: 600, color: theme.ink, whiteSpace: "nowrap", opacity: ramp(t, 10, 12) }}>{el.label}</div>}
      </div>
    );
  } else if (el.type === "text") {
    const upd = [...(el.updates ?? [])].reverse().find((u) => frame >= u.at);
    const next = upd && String(upd.content.value ?? upd.content.title ?? upd.content.amount ?? upd.content.label ?? "");
    body = <TextObject text={next || el.text} w={w} h={h} t={upd ? frame - upd.at : t} theme={theme} />;
  } else if (el.type === "shape") {
    body = <ShapeObject shape={el.shape} label={el.label} w={w} h={h} t={t} frame={frame} theme={theme} />;
  } else if (el.type === "visual") {
    body = <VisualObject visual={el.visual} label={el.label} w={w} h={h} t={t} frame={frame} theme={theme} />;
  } else if (el.type === "logo") {
    body = (
      <div style={{ width: w, height: h, borderRadius: Math.min(w, h) * 0.24, background: "rgba(255,255,255,.95)", boxShadow: `0 30px 70px ${theme.glow}0.25), inset 0 0 0 1.5px #fff`, display: "flex", alignItems: "center", justifyContent: "center", padding: 18, boxSizing: "border-box" }}>
        {el.src ? <Img src={el.src} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} /> : <span style={{ fontSize: h * 0.34, fontWeight: 750, color: theme.primary, letterSpacing: "-0.03em" }}>{el.text}</span>}
      </div>
    );
  }

  const three = rx || ry || rz;
  // Idle float: every element drifts a few pixels on its own slow cycle, so a
  // held scene never looks frozen.
  let seed = 0;
  for (const ch of node.id) seed = (seed * 31 + ch.charCodeAt(0)) % 997;
  const ph = ((frame + seed * 7) / 150) * Math.PI * 2;
  const amp = calm ? 0.4 : 1; // the hero holds still while it is read
  const [fx, fy] = [Math.cos(ph * 0.8) * 3 * amp, Math.sin(ph) * 5 * amp];
  return (
    <div style={{ position: "absolute", left: pos[0], top: pos[1], width: 0, height: 0, zIndex: node.z ?? 0, perspective: three ? 2400 : undefined }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          transform: `translate(calc(-50% + ${fx.toFixed(2)}px), calc(-50% + ${fy.toFixed(2)}px)) scale(${scale}) rotate(${rot}deg)${three ? ` rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)` : ""}`,
          opacity: opacity * (1 - erase * 0.6),
          filter: blur + erase * 10 > 0.2 ? `blur(${blur + erase * 10}px)` : undefined,
          clipPath: erase > 0 ? `inset(0 0 0 ${erase * 100}%)` : undefined,
        }}
      >
        {body}
      </div>
    </div>
  );
}
