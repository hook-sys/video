import { AbsoluteFill, useCurrentFrame } from "remotion";
import { FLOW_FONT, THEMES } from "../themes";
import type { ThemeName } from "../types";
import { Card, cardSize } from "./card";
import { Crop, Device } from "./devices";
import { CARD_TEMPLATES } from "./templates";
import type { CardStyle } from "./types";

// Dev/QA composition: every card template on a page grid (one style per
// page), animating from frame 0, plus the device mockups. Rendered by
// `npm run check:story` for inspection.
export const CARD_GALLERY_ID = "CardGallery";
export const CARD_GALLERY_PER_PAGE = 18;
export const cardGalleryPages = () => Math.ceil(CARD_TEMPLATES.length / CARD_GALLERY_PER_PAGE) + 1;

const SHOT =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="900"><rect width="1440" height="900" fill="#F6F7FB"/><rect width="1440" height="70" fill="#1E1B4B"/><rect x="40" y="110" width="420" height="220" rx="16" fill="#DDE3FF"/><rect x="500" y="110" width="900" height="220" rx="16" fill="#FFFFFF"/><rect x="40" y="370" width="1360" height="480" rx="16" fill="#FFFFFF"/><rect x="80" y="420" width="600" height="28" rx="8" fill="#E3E6EF"/><rect x="80" y="470" width="900" height="28" rx="8" fill="#E3E6EF"/></svg>',
  );

export function CardGallery({ page = 0, style = "glass", theme = "teal" }: { page?: number; style?: CardStyle; theme?: ThemeName }) {
  const frame = useCurrentFrame();
  const th = THEMES[theme];
  const devicesPage = page >= cardGalleryPages() - 1;
  const list = CARD_TEMPLATES.slice(page * CARD_GALLERY_PER_PAGE, (page + 1) * CARD_GALLERY_PER_PAGE);
  return (
    <AbsoluteFill style={{ background: style === "dark" ? "#0E0F14" : `linear-gradient(160deg, #FFFFFF, ${th.soft})`, fontFamily: FLOW_FONT }}>
      {devicesPage ? (
        <div style={{ position: "absolute", inset: 40, display: "flex", flexWrap: "wrap", gap: 40, alignItems: "flex-start", transform: "scale(0.62)", transformOrigin: "top left", width: "160%" }}>
          {(["browser", "laptop", "phone", "tablet", "monitor", "watch"] as const).map((m) => (
            <Device key={m} model={m} finish={m === "phone" ? "dark" : "light"}>
              <Crop src={SHOT} crop={m === "watch" ? "top-left-detail" : "full"} w={2000} h={2000} />
            </Device>
          ))}
        </div>
      ) : (
        <div style={{ position: "absolute", inset: 30, display: "grid", gridTemplateColumns: "repeat(6, 290px)", gap: 14, columnGap: 18, alignItems: "start" }}>
          {list.map((t) => (
            <div key={t.id} style={{ width: 290, height: (cardSize(t).h * 290) / t.w + 22 }}>
              <div style={{ transform: `scale(${290 / t.w})`, transformOrigin: "top left", width: t.w }}>
                <Card tpl={t} style={style} theme={th} t={frame} />
              </div>
              <div style={{ position: "relative", top: 2, fontSize: 13, color: "#999" }}>{t.id}</div>
            </div>
          ))}
        </div>
      )}
    </AbsoluteFill>
  );
}
