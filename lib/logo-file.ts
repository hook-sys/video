// A customer's icon in Storage: `logo.png` / `logo.jpg` / `logo.jpeg` / `logo.webp`,
// any case, in the project folder or one folder down. The old lookup asked
// Storage for names starting with "logo." and then kept only a case-sensitive
// "logo." prefix, in that one folder. This is the name check both sides share.

export const LOGO_EXTS = ["png", "jpg", "jpeg", "webp"] as const;

const LOGO_NAME = /^logo\.(png|jpe?g|webp)$/i;

export const isLogoFileName = (name: string) => LOGO_NAME.test(name.split("/").pop() ?? "");

const rank = (name: string) => {
  const ext = (name.split(".").pop() ?? "").toLowerCase();
  return ext === "png" ? 0 : ext === "webp" ? 1 : ext === "jpg" ? 2 : ext === "jpeg" ? 3 : 9;
};

export type ListedFile = { name: string; id?: string | null };

// A folder comes back with no id. Prefer a PNG, then WebP, then JPEG.
export function pickLogo(entries: ListedFile[]): string | null {
  const files = entries.filter((e) => e.id !== null && !!e.name && isLogoFileName(e.name));
  files.sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name));
  return files[0]?.name ?? null;
}

export const canonicalLogoPaths = (userId: string, projectId: string) =>
  LOGO_EXTS.map((ext) => `${userId}/${projectId}/logo.${ext}`);
