import Link from "next/link";
import { Mark, Wordmark } from "./windows";
import "./site.css";
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
        <a href={`mailto:${email}`} className="font-medium text-[#c4b5fd] hover:underline">
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
    <div className="gs gs-dark min-h-dvh text-[#e4e2f0]">
      <header className="relative z-[1] mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-5">
        <Link href="/" className="gs-brand flex items-center gap-2" aria-label="MotionDots home">
          <Mark />
          <Wordmark />
        </Link>
        <nav className="flex gap-4 text-sm text-white/55">
          {LEGAL_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-white">
              {l.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="relative z-[1] mx-auto max-w-3xl px-4 pb-20">
        <article className="rounded-3xl bg-white/[0.045] p-6 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.9)] ring-1 ring-white/[0.08] sm:p-10 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:mt-1.5 [&_p]:mt-3 [&_p]:leading-relaxed [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:leading-relaxed">
          <h1 className="text-3xl font-extrabold tracking-tight text-white">{title}</h1>
          <p className="text-sm text-white/45">Last updated {LEGAL_UPDATED}</p>
          {children}
        </article>
      </main>
    </div>
  );
}
