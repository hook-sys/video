import Link from "next/link";
import { getSettings } from "@/lib/app-settings";
import { LEGAL_LINKS } from "./legal-links";

// The Terms, Privacy and Refund pages: plain reading pages, open to everyone,
// with the support contact set on /admin/settings.

export const LEGAL_UPDATED = "13 November 2026";

export async function supportContact() {
  const s = await getSettings();
  return { email: String(s.support_email ?? "").trim(), phone: String(s.support_phone ?? "").trim() };
}

export function Contact({ email, phone }: { email: string; phone: string }) {
  if (!email && !phone) return <>through the support details on our website</>;
  return (
    <>
      {email && (
        <a href={`mailto:${email}`} className="font-medium text-[#0a66d6] hover:underline">
          {email}
        </a>
      )}
      {email && phone && " or "}
      {phone && <span className="font-medium">{phone}</span>}
    </>
  );
}

export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#f5f5f7] text-[#1d1d1f]">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-5">
        <Link href="/" className="text-base font-semibold tracking-tight">
          MotionBrief
        </Link>
        <nav className="flex gap-4 text-sm text-[#1d1d1f]/60">
          {LEGAL_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-[#1d1d1f]">
              {l.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-20">
        <article className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/[0.05] sm:p-10 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:mt-1.5 [&_p]:mt-3 [&_p]:leading-relaxed [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:leading-relaxed">
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-[#1d1d1f]/50">Last updated {LEGAL_UPDATED}</p>
          {children}
        </article>
      </main>
    </div>
  );
}
