import Link from "next/link";

// The links to the Terms, Privacy and Refund pages (the site's footers; components/site/legal.tsx).
export const LEGAL_LINKS = [
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/refund", label: "Refunds" },
];

export function LegalFooterLinks() {
  return (
    <>
      © MotionDots
      {LEGAL_LINKS.map((l) => (
        <span key={l.href}>
          {" · "}
          <Link href={l.href} className="hover:underline">
            {l.label}
          </Link>
        </span>
      ))}
    </>
  );
}
