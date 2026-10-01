// Visual quality gate for the hero objects, filled in by hand after looking
// at every view, the turntable and 100% crops on a dark background. Only
// `production: true` objects (score ≥ 90) go on the hero allowlist.
//
// Review (2 Oct 2026, renders from scripts/hero3d at 2400 px): all six are
// clean, consistent and artifact-free, but they are real-time PBR renders with
// no ambient occlusion, global illumination or surface micro-detail, so none
// reads as a premium product render yet. All held back; they may be used as
// supporting objects (80+) once the workflow is wired.
export const QUALITY = {
  "hero:payment-card": { score: 84, production: false, notes: "Believable titanium card with real edge thickness and gold contacts; face is a flat, untextured gradient with no brushed grain or micro-scratches." },
  "hero:chart-block": { score: 82, production: false, notes: "Clear read; frosted base looks like grey plastic rather than glass, bars lack occlusion where they meet the base." },
  "hero:padlock": { score: 84, production: false, notes: "Clean bevels and chrome shackle; glass face reads as flat grey, no contact darkening at the shackle entry." },
  "hero:ai-chip": { score: 86, production: false, notes: "Strongest of the set: gold pins, spreader and traces read well; spreader is untextured and the package has no occlusion." },
  "hero:document-stack": { score: 82, production: false, notes: "Paper and stack depth believable; line blocks and the clip are simple, no paper grain or soft occlusion between sheets." },
  "hero:chat-bubble": { score: 78, production: false, notes: "Milky acrylic instead of glass (no refraction on a transparent background); weakest of the set." },
};
