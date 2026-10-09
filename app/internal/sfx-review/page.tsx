import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";

// Listening page for the SFX library jobs (see /internal/sfx-jobs). Preview only, admins only.
export const dynamic = "force-dynamic";

export default async function SfxReview() {
  if (process.env.VERCEL_ENV !== "preview") notFound();
  const { db } = await requireAdmin();
  const { data } = await db
    .from("sfx_jobs")
    .select("id, name, variant, take, prompt, duration_seconds, status, audio_b64, error")
    .order("name")
    .order("variant")
    .order("take")
    .limit(1000);
  const rows = data ?? [];
  const names = [...new Set(rows.map((r) => r.name))];
  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>SFX review</h1>
      <p style={{ color: "#666" }}>
        {names.length} sounds · {rows.filter((r) => r.status === "done").length} takes ready · {rows.filter((r) => r.status === "failed").length} failed
      </p>
      {names.map((name) => {
        const takes = rows.filter((r) => r.name === name);
        return (
          <section key={name} style={{ borderTop: "1px solid #ddd", padding: "14px 0" }}>
            <h2 style={{ fontSize: 17, fontWeight: 700 }}>{name}</h2>
            <p style={{ color: "#666", fontSize: 13, margin: "4px 0 10px" }}>
              {takes[0].prompt} · {Number(takes[0].duration_seconds)} s
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              {takes.map((t) => (
                <div key={t.id} style={{ fontSize: 13 }}>
                  <div>
                    #{t.id} · v{t.variant} take {t.take}
                  </div>
                  {t.audio_b64 ? <audio controls preload="none" src={`data:audio/mpeg;base64,${t.audio_b64}`} /> : <em>{t.status}{t.error ? `: ${t.error}` : ""}</em>}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </main>
  );
}
