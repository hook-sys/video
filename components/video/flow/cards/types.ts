// Card library: product-UI cards built from a small set of blocks. A template
// is data (blocks + default content); the renderer animates every block from
// the moment the card appears. Content slots are generic, so the Director can
// fill any template with the same keys.

export type Tone = "success" | "warn" | "danger" | "info" | "neutral" | "brand";

export type Row = { icon?: string; text: string; value?: string; status?: string; tone?: Tone };

export type Block =
  | { type: "header"; icon: string; title: string; sub?: string; badge?: string; tone?: Tone }
  | { type: "avatar"; name: string; sub?: string; badge?: string; tone?: Tone }
  | { type: "bignum"; value: string; label?: string; delta?: string; tone?: Tone }
  | { type: "chip"; text: string; tone?: Tone; icon?: string }
  | { type: "rows"; items: Row[] | string[] | string; icon?: string }
  | { type: "progress"; label?: string; value: number; tone?: Tone }
  | { type: "bars"; values: number[] }
  | { type: "line"; values: number[]; tone?: Tone }
  | { type: "donut"; value: number; label?: string }
  | { type: "button"; text: string; icon?: string; tone?: Tone }
  | { type: "bubble"; text: string; side?: "left" | "right" }
  | { type: "stars"; n: number; label?: string }
  | { type: "steps"; items: string[] | string; active: number }
  | { type: "toggle"; label: string; on: boolean }
  | { type: "kv"; pairs: [string, string][] }
  | { type: "tags"; items: string[] | string }
  | { type: "code"; lines: string[] }
  | { type: "checklist"; items: string[] | string }
  | { type: "price"; amount: string; period?: string }
  | { type: "input"; label: string; value: string; icon?: string }
  | { type: "calendar"; days: number[] }
  | { type: "map" }
  | { type: "media"; icon: string; ratio?: number }
  | { type: "table"; cols: string[]; rows: string[][] }
  | { type: "heat" }
  | { type: "typing" }
  | { type: "text"; text: string; muted?: boolean; size?: "s" | "m" | "l" }
  | { type: "qr" }
  | { type: "divider" }
  | { type: "stages"; items: string[] | string; counts?: number[]; active: number } // a pipeline: deal / hiring / order stages
  | { type: "slots"; items: string[] | string; active: number } // bookable time slots, one picked
  | { type: "log"; lines: string[] | string } // a terminal / deploy log
  | { type: "signature"; name: string } // a signature being drawn
  | { type: "meter"; value: number; label?: string } // a half-circle gauge
  | { type: "avatars"; n: number; label?: string } // a stack of people
  | { type: "timeline"; items: string[] | string }; // a vertical activity timeline

export type BlockType = Block["type"];

// Content the Director may set on any card; templates use them as "{title}",
// "{items}" and so on, with their own defaults.
export type CardContent = Partial<{
  title: string;
  subtitle: string;
  value: string;
  label: string;
  status: string;
  name: string;
  amount: string;
  delta: string;
  note: string;
  action: string;
  date: string;
  items: string[];
}>;

export type CardTemplate = {
  id: string;
  category: string;
  description: string;
  tags: string[];
  w: number; // width in world px
  blocks: Block[];
  defaults: CardContent;
};

export const CARD_STYLES = ["glass", "solid", "tinted", "dark", "accent"] as const;
export type CardStyle = (typeof CARD_STYLES)[number];
