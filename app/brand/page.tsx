import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/site/app-shell";
import { userAccess } from "@/lib/admin";
import { BRAND_KITS_MAX, listBrandKits } from "@/lib/brand-kits";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { deleteBrandKit, setDefaultBrandKit } from "./actions";
import { KitForm } from "./kit-form";

export const metadata: Metadata = { title: "Brand kits" };

// The customer's saved brands: each kept once (name, colour, icon, website,
// phone, tagline) and picked on the new-video form, so the icon is never
// uploaded again.
export default async function BrandPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { error, ok, edit } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ admin }, kits] = await Promise.all([userAccess(supabase, user.id), listBrandKits(createAdminClient(), user.id)]);
  const editing = typeof edit === "string" ? kits.find((k) => k.id === edit) : undefined;

  return (
    <AppShell title="Brand kits" admin={admin} active="brand" initial={(user.email ?? "?")[0]}>
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your brand kits</h1>
          <p className="mt-1 text-sm text-foreground/60">Save your brand once — pick it when you make a video, no need to upload your icon again.</p>
        </div>

        {typeof error === "string" && <p className="rounded-xl border border-amber-500/30 bg-amber-50 px-4 py-3 text-sm text-amber-900">{error}</p>}
        {typeof ok === "string" && <p className="rounded-xl border border-emerald-500/30 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{ok}</p>}

        {kits.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {kits.map((k) => (
              <div key={k.id} className="flex flex-col gap-3 rounded-2xl border border-foreground/10 bg-white/80 p-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#fff] ring-1 ring-black/5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {k.logoUrl ? <img src={k.logoUrl} alt="" className="max-h-11 max-w-11 object-contain" /> : <span className="text-xs text-foreground/40">No icon</span>}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate font-semibold">
                      {k.color && <span className="inline-block size-3 shrink-0 rounded-full" style={{ background: k.color }} />}
                      <span className="truncate">{k.name}</span>
                      {k.isDefault && <span className="rounded-full bg-[#0a66d6]/10 px-2 py-0.5 text-[11px] font-medium text-[#0a66d6]">Default</span>}
                    </p>
                    <p className="truncate text-xs text-foreground/55">{[k.websiteUrl, k.phone].filter(Boolean).join(" · ") || "—"}</p>
                    {k.tagline && <p className="truncate text-xs text-foreground/55">{k.tagline}</p>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-sm">
                  <a href={`/brand?edit=${k.id}`} className="rounded-full border border-foreground/12 px-3 py-1 hover:border-foreground/30">
                    Edit
                  </a>
                  {!k.isDefault && (
                    <form action={setDefaultBrandKit}>
                      <input type="hidden" name="id" value={k.id} />
                      <button className="rounded-full border border-foreground/12 px-3 py-1 hover:border-foreground/30">Make default</button>
                    </form>
                  )}
                  <form action={deleteBrandKit}>
                    <input type="hidden" name="id" value={k.id} />
                    <button className="rounded-full border border-red-500/25 px-3 py-1 text-red-700 hover:border-red-500/50">Remove</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}

        {editing || kits.length < BRAND_KITS_MAX ? (
          <KitForm key={editing?.id ?? "new"} kit={editing} />
        ) : (
          <p className="text-sm text-foreground/60">You have {BRAND_KITS_MAX} brand kits — remove one to add another.</p>
        )}
      </div>
    </AppShell>
  );
}
