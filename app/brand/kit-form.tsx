"use client";

import { useState } from "react";
import { BRAND_NAME_MAX, LOGO_MAX_BYTES, validateLogo } from "@/lib/projects";
import { Field, Upload, colourOf } from "@/app/projects/new/form-parts";
import type { BrandKit } from "@/lib/brand-kits";
import { saveBrandKit } from "./actions";

const input =
  "w-full rounded-xl border border-foreground/12 bg-white/80 px-3.5 py-2.5 text-sm placeholder:text-foreground/35 focus:border-[#0a66d6] focus:outline-none focus:ring-4 focus:ring-[#0a66d6]/15";

// A brand kit, new or changed: the icon (its colour read from it, changeable),
// the name, the website, a phone number and a tagline.
export function KitForm({ kit }: { kit?: BrandKit }) {
  const [logo, setLogo] = useState<{ name: string; url: string } | null>(null);
  const [logoError, setLogoError] = useState<string>();
  const [color, setColor] = useState(kit?.color ?? "");
  const shown = logo?.url ?? kit?.logoUrl ?? null;

  return (
    <form action={saveBrandKit} className="flex flex-col gap-4 rounded-2xl bg-white/70 p-5 ring-1 ring-black/[0.06]">
      <h2 className="text-base font-semibold">{kit ? `Edit ${kit.name}` : "Add a brand kit"}</h2>
      {kit && <input type="hidden" name="id" value={kit.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Upload
          title="Icon"
          text={logo ? logo.name : kit?.logoUrl ? "Change the icon" : "Upload your icon"}
          sub={`PNG, JPG or WebP · up to ${LOGO_MAX_BYTES / 1024 / 1024} MB`}
          // eslint-disable-next-line @next/next/no-img-element
          preview={shown ? <img src={shown} alt="" className="max-h-12 max-w-[70%] object-contain" /> : undefined}
        >
          <input
            name="logo"
            type="file"
            required={!kit}
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (logo) URL.revokeObjectURL(logo.url);
              const problem = validateLogo(file);
              setLogoError(problem);
              if (!file || problem) return setLogo(null);
              const url = URL.createObjectURL(file);
              setLogo({ name: file.name, url });
              colourOf(url, "").then((c) => c && setColor(c)).catch(() => {});
            }}
          />
        </Upload>
        <div className="flex flex-col gap-4">
          <Field title="Company name">
            <input name="name" required defaultValue={kit?.name} maxLength={BRAND_NAME_MAX} placeholder="Your company name" className={input} />
          </Field>
          <Field title="Brand colour">
            <span className="flex items-center gap-2">
              <input type="color" value={color || "#0a66d6"} onChange={(e) => setColor(e.target.value.toUpperCase())} className="h-10 w-12 cursor-pointer rounded-lg border border-foreground/12 bg-white" />
              <input name="color" value={color} onChange={(e) => setColor(e.target.value.trim())} placeholder="From your icon" maxLength={7} className={input} />
            </span>
          </Field>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field title="Website (optional)">
          <input name="website_url" type="text" inputMode="url" defaultValue={kit?.websiteUrl ?? ""} maxLength={300} placeholder="yourcompany.com" className={input} />
        </Field>
        <Field title="Phone (optional)">
          <input name="phone" type="tel" defaultValue={kit?.phone ?? ""} maxLength={30} placeholder="01XXXXXXXXX" className={input} />
        </Field>
        <Field title="Tagline (optional)">
          <input name="tagline" defaultValue={kit?.tagline ?? ""} maxLength={120} placeholder="A line about your brand" className={input} />
        </Field>
      </div>
      {logoError && <p className="text-sm text-red-700">{logoError}</p>}
      <div className="flex gap-2">
        <button disabled={!!logoError} className="rounded-full bg-[#0a66d6] px-5 py-2 text-sm font-medium text-white hover:bg-[#0857b8] disabled:opacity-50">
          {kit ? "Save changes" : "Save brand kit"}
        </button>
        {kit && (
          <a href="/brand" className="rounded-full border border-foreground/12 px-5 py-2 text-sm hover:border-foreground/30">
            Cancel
          </a>
        )}
      </div>
    </form>
  );
}
