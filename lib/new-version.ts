import "server-only";
import { getSettings } from "@/lib/app-settings";

// "New version" (admin → Settings, super admin only; off by default): the
// new video maker in lib/v2. Off, the app works exactly as before. Each
// project keeps the version it was made with (projects.details.engine), so a
// video renders and retries the same way whatever the switch says later.
export const NEW_VERSION_KEY = "feature_new_version";
export type Engine = "v1" | "v2";

export async function newVersionOn(): Promise<boolean> {
  return (await getSettings())[NEW_VERSION_KEY] === true;
}

// The version a project was made with (older projects: v1).
export const engineOf = (details: unknown): Engine => (details && typeof details === "object" && (details as { engine?: unknown }).engine === "v2" ? "v2" : "v1");
