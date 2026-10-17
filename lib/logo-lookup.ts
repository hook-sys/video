import { SCREENSHOTS_BUCKET } from "@/lib/projects";
import { canonicalLogoPaths, pickLogo, type ListedFile } from "@/lib/logo-file";

// Long enough for a preview left open and for the browser render that follows.
export const LOGO_URL_SECONDS = 6 * 3600;

export type LogoList = {
  list: (folder: string, search?: string) => Promise<{ entries: ListedFile[] | null; error?: string }>;
  // true: the file is there. false: it is not. null: the check itself failed.
  exists: (path: string) => Promise<boolean | null>;
};

export type LogoHit = { path: string; reason?: undefined } | { path?: undefined; reason: string };

const baseName = (name: string) => name.split("/").pop() || name;
const NEST = 8;

// Where the uploaded icon actually is. The usual file is `logo.png` beside
// the project; a list that misses it (a storage error, a different case, a
// jpeg name, a file one folder down) is not the end of the search.
export async function findLogoPath(store: LogoList, userId: string, projectId: string): Promise<LogoHit> {
  const root = `${userId}/${projectId}`;
  const notes: string[] = [];

  for (const path of canonicalLogoPaths(userId, projectId)) {
    let ok: boolean | null = null;
    try {
      ok = await store.exists(path);
    } catch {
      ok = null;
    }
    if (ok === true) return { path };
    if (ok === null) notes.push(`${baseName(path)} could not be checked`);
  }

  const searched = await store.list(root, "logo").catch((e: unknown) => ({ entries: null as ListedFile[] | null, error: e instanceof Error ? e.message : "list failed" }));
  if (searched.error) notes.push(`search: ${searched.error}`);
  const fromSearch = pickLogo(searched.entries ?? []);
  if (fromSearch) return { path: `${root}/${baseName(fromSearch)}` };

  const all = await store.list(root).catch((e: unknown) => ({ entries: null as ListedFile[] | null, error: e instanceof Error ? e.message : "list failed" }));
  if (all.error) notes.push(`list: ${all.error}`);
  const fromAll = pickLogo(all.entries ?? []);
  if (fromAll) return { path: `${root}/${baseName(fromAll)}` };

  const folders = (all.entries ?? []).filter((e) => e.id === null && !!e.name && !e.name.startsWith(".")).slice(0, NEST);
  for (const folder of folders) {
    const dir = `${root}/${folder.name}`;
    const nested = await store.list(dir, "logo").catch(() => ({ entries: null as ListedFile[] | null, error: "list failed" }));
    const hit = pickLogo(nested.entries ?? []) ?? pickLogo((await store.list(dir).catch(() => ({ entries: null as ListedFile[] | null }))).entries ?? []);
    if (hit) return { path: `${dir}/${baseName(hit)}` };
  }

  const why = notes.length ? ` (${notes.join("; ")})` : "";
  if (searched.entries === null && all.entries === null) return { reason: `could not list ${root}${why}` };
  return { reason: `no logo.png, logo.jpg or logo.webp in ${root}${why}` };
}

type SignClient = {
  storage: {
    from: (bucket: string) => {
      list: (path: string, options?: { search?: string; limit?: number }) => PromiseLike<{ data: { name: string; id: string | null }[] | null; error: { message: string } | null }>;
      exists: (path: string) => PromiseLike<{ data: boolean; error: unknown }>;
      createSignedUrl: (path: string, expiresIn: number) => PromiseLike<{ data: { signedUrl: string } | null; error: { message: string } | null }>;
    };
  };
};

// A fresh signed URL for a new-version video's icon, or why there isn't one.
export async function signLogo(supabase: SignClient, userId: string, projectId: string, expiresIn = LOGO_URL_SECONDS): Promise<{ url: string | null; reason: string | null }> {
  const bucket = supabase.storage.from(SCREENSHOTS_BUCKET);
  const found = await findLogoPath(
    {
      list: async (folder, search) => {
        const { data, error } = await bucket.list(folder, { limit: 100, ...(search ? { search } : {}) });
        if (error) return { entries: null, error: error.message };
        return { entries: (data ?? []).map((f) => ({ name: f.name, id: f.id })) };
      },
      exists: async (path) => {
        try {
          const { data } = await bucket.exists(path);
          if (data === true) return true;
          if (data === false) return false;
          return null;
        } catch {
          return null;
        }
      },
    },
    userId,
    projectId,
  );
  if (!found.path) {
    const reason = found.reason ?? "no logo file";
    console.warn("v2 logo:", reason);
    return { url: null, reason };
  }
  const { data, error } = await bucket.createSignedUrl(found.path, expiresIn);
  if (!data?.signedUrl) {
    const reason = `could not sign ${found.path}${error ? `: ${error.message}` : ""}`;
    console.warn("v2 logo:", reason);
    return { url: null, reason };
  }
  return { url: data.signedUrl, reason: null };
}
