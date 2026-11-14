import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// The AI providers' API keys (docs/video-spec.md, AI providers): each from the environment, or saved by a
// super admin on /admin/models — stored encrypted (AES-256-GCM, its key derived from the service role key,
// which only the server holds) in app_settings "ai_keys", which only the service role can read. A saved key
// wins over the environment's. A key is never sent back to a browser: the page sees only its last four.

export const PROVIDERS = ["google", "openai", "anthropic", "fal"] as const;
export type AnyProvider = (typeof PROVIDERS)[number];
export const PROVIDER_NAME: Record<AnyProvider, string> = { google: "Google (Gemini)", openai: "OpenAI", anthropic: "Anthropic (Claude)", fal: "fal" };
export const PROVIDER_ENV: Record<AnyProvider, string> = { google: "GEMINI_API_KEY", openai: "OPENAI_API_KEY", anthropic: "ANTHROPIC_API_KEY", fal: "FAL_KEY" };
export const KEYS_SETTING = "ai_keys";

type Sealed = { iv: string; tag: string; data: string; last4: string; at: string };
type Stored = Partial<Record<AnyProvider, Sealed>>;

const secret = () => {
  const base = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base) throw new Error("The server has no service role key: keys can't be saved.");
  return createHash("sha256").update(`ai-keys:${base}`).digest();
};
export function seal(key: string): Sealed {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", secret(), iv);
  const data = Buffer.concat([c.update(key, "utf8"), c.final()]);
  return { iv: iv.toString("base64"), tag: c.getAuthTag().toString("base64"), data: data.toString("base64"), last4: key.slice(-4), at: new Date().toISOString() };
}
function open(s: Sealed): string | null {
  try {
    const d = createDecipheriv("aes-256-gcm", secret(), Buffer.from(s.iv, "base64"));
    d.setAuthTag(Buffer.from(s.tag, "base64"));
    return Buffer.concat([d.update(Buffer.from(s.data, "base64")), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

// the saved keys, opened — read with the AI settings (lib/ai/models.ts), so a call made after them finds them
let saved: Partial<Record<AnyProvider, string>> = {};
let savedAt = 0;
let stored: Stored = {};
export async function loadAiKeys(force = false): Promise<void> {
  if (!force && Date.now() - savedAt < 15_000) return;
  savedAt = Date.now();
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const { data } = await createAdminClient().from("app_settings").select("value").eq("key", KEYS_SETTING).maybeSingle();
    stored = ((data?.value ?? {}) as Stored) || {};
    saved = Object.fromEntries(PROVIDERS.flatMap((p) => (stored[p] ? [[p, open(stored[p]!)]] : [])).filter(([, k]) => k)) as typeof saved;
  } catch {
    // (no database: the environment's keys only)
  }
}
export const forgetAiKeys = () => void (savedAt = 0);

// A provider's key: the saved one, else the environment's; null when it has none
export function providerKey(p: AnyProvider): string | null {
  return saved[p] || process.env[PROVIDER_ENV[p]] || null;
}
// What the admin page may show: where each key comes from and its last four
export function keyStatus(): Record<AnyProvider, { source: "saved" | "environment" | null; last4: string | null; at: string | null }> {
  return Object.fromEntries(
    PROVIDERS.map((p) => {
      const env = process.env[PROVIDER_ENV[p]];
      if (saved[p] && stored[p]) return [p, { source: "saved", last4: stored[p]!.last4, at: stored[p]!.at }];
      if (env) return [p, { source: "environment", last4: env.slice(-4), at: null }];
      return [p, { source: null, last4: null, at: null }];
    }),
  ) as ReturnType<typeof keyStatus>;
}
// the stored value with one key set (or removed, `key` null)
export function withKey(p: AnyProvider, key: string | null): Stored {
  const next: Stored = { ...stored };
  if (key) next[p] = seal(key);
  else delete next[p];
  return next;
}
