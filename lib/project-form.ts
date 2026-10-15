// Which questions the new-video form asks (admin → Settings, "Form: …"):
// each can be turned off to test videos made from less (or more) of what the
// customer says. The script, the company name, the format and the quality
// are always asked. Shared by the form (browser) and createProject (server).

export const FORM_FIELDS = ["logo", "business", "audience", "mood", "use", "voice", "ending", "screenshots", "direction"] as const;
export type FormField = (typeof FORM_FIELDS)[number];
export type FormAsk = Record<FormField, boolean>;

export const FORM_FIELD_LABEL: Record<FormField, string> = {
  logo: "Icon (and the brand colour taken from it)",
  business: "Type of business",
  audience: "Who it's for",
  mood: "Mood",
  use: "Where the video will be used",
  voice: "Voice",
  ending: "The ending (call to action and website)",
  screenshots: "Screenshots (up to 5)",
  direction: "Video direction",
};

// (every question is asked unless the team turned it off)
export const formAskOf = (settings: Record<string, unknown>): FormAsk =>
  Object.fromEntries(FORM_FIELDS.map((f) => [f, settings[`form_${f}`] !== false])) as FormAsk;
