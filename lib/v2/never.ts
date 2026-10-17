import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { VIDEO_RULES } from "@/lib/video-rules";

// "New version": the team's never list with the new version's own changes
// (the premium SaaS motion of the reference films) — the old version's list
// is untouched. Built-in rules changed or left out here; a `video_rules` row
// with a built-in rule's id overrides it for the new version only (an
// inactive one leaves it out) — the old version never reads those rows over
// its built-in rules.

const CHANGED: Record<string, string | null> = {
  // 7: one hero and up to 3–4 beside it; a row or list is one group
  crowded: "never put more than one hero and 3–4 supporting things on screen at once (a staggered list or a row of icons counts as one group; a badge aside)",
  // 12, 13: screenshots are not part of the new version
  "tiny-screens": null,
  "unused-screens": null,
  // 19: the brand colour plus one harmonious accent
  "off-brand": "never pick colours that fight the client's brand: the brand colour plus one harmonious accent; with no brand colour, the one drawn for the video",
  // 22: glow on dark, soft shadows and glass on light
  "off-palette": "never add colours beyond the brand colour, one harmonious accent and neutrals; glow only on a dark background, soft shadows and glass on a light one — never harsh black shadows",
  // 23: animated mesh, gradient, grain or grid backgrounds are allowed
  "busy-backdrop": null,
  // 26: abstract glass or geometric 3D shapes are allowed
  "random-decor": "never use emoji or mascots; abstract glass or geometric 3D shapes are fine as decoration, never in front of the words or the hero",
  // 42: UI springs in; only spin and an excessive bounce are banned
  "wild-entrances": "never spin a thing in or let it bounce more than once: the product's UI springs in and settles",
  // 43: one main movement, the camera aside; groups staggered
  "many-moves": "never move several things in different directions at once: one main movement at a time (the camera's slow drift, push or parallax aside); things that come in together stagger 50–100 ms apart",
  // 44: zoom-through, mask wipe, morph and slide are allowed by energy
  "transition-zoo": null,
  // 49: the hero-* cap is gone
  "same-layouts": "never use the same layout family twice in a row: vary with round (hub, ring, arc) and flowing (pipeline, diagonal, split) compositions",
};

type Row = { id: string; never: string; active: boolean };

// The new version's never list (most broken first, as the old one).
export function v2NeverList(rows: Row[] = []): string {
  const byId = new Map(rows.filter((r) => VIDEO_RULES.some((b) => b.id === r.id)).map((r) => [r.id, r]));
  const builtIn = VIDEO_RULES.filter((r) => r.enforced.includes("prompt") || r.enforced.includes("detect")).flatMap((r) => {
    const row = byId.get(r.id);
    if (row) return row.active && row.never.trim() ? [{ id: r.id, never: row.never.trim() }] : [];
    const changed = r.id in CHANGED ? CHANGED[r.id] : r.never;
    return changed ? [{ id: r.id, never: changed }] : [];
  });
  const added = rows.filter((r) => r.active && !byId.has(r.id)).map((r) => ({ id: r.id, never: r.never }));
  // (the built-in ones first, then the team's own — as the old version's list)
  return [...builtIn, ...added].map((r) => `- ${r.never}`).join("\n");
}

export async function loadV2NeverList(admin: ReturnType<typeof createAdminClient>): Promise<string> {
  try {
    const { data } = await admin.from("video_rules").select("id, never, active").limit(100);
    return v2NeverList((data ?? []) as Row[]);
  } catch {
    return v2NeverList();
  }
}
