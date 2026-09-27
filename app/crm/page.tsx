import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Contact } from "@/lib/crm";
import { createContact, deleteContact } from "./actions";
import { ContactForm } from "./contact-form";

export default async function CrmPage({ searchParams }: PageProps<"/crm">) {
  const { q, error } = await searchParams;
  // Strip characters that have meaning in PostgREST filter syntax.
  const search = typeof q === "string" ? q.replace(/[,()%_*\\"]/g, " ").trim() : "";

  const supabase = await createClient();
  let query = supabase
    .from("crm_contacts")
    .select("id, name, company, email, phone, notes, status")
    .order("created_at", { ascending: false });
  if (search) {
    const like = `%${search}%`;
    query = query.or(`name.ilike.${like},company.ilike.${like},email.ilike.${like}`);
  }
  const { data } = await query;
  const contacts = (data ?? []) as Contact[];

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-12">
      <Link href="/dashboard" className="text-sm text-foreground/70 underline">
        ← Dashboard
      </Link>
      <h1 className="text-2xl font-semibold">CRM</h1>
      {typeof error === "string" && <p className="text-sm text-red-600">{error}</p>}

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Add contact</h2>
        <ContactForm action={createContact} submitLabel="Add contact" />
      </section>

      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={search}
          placeholder="Search name, company or email"
          className="flex-1 rounded-md border border-foreground/20 bg-transparent px-3 py-2"
        />
        <button className="rounded-md border border-foreground/20 px-3 py-2 text-sm">Search</button>
      </form>

      {contacts.length === 0 ? (
        <p className="text-sm text-foreground/60">No contacts found.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-foreground/10 text-sm">
          {contacts.map((c) => (
            <li key={c.id} className="flex items-start justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="font-medium">
                  {c.name}{" "}
                  <span className="font-normal text-foreground/60">· {c.status}</span>
                </p>
                <p className="break-words text-foreground/70">
                  {[c.company, c.email, c.phone].filter(Boolean).join(" · ")}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Link href={`/crm/${c.id}`} className="rounded-md border border-foreground/20 px-3 py-1.5">
                  Edit
                </Link>
                <form action={deleteContact.bind(null, c.id)}>
                  <button className="rounded-md border border-foreground/20 px-3 py-1.5 text-red-600">
                    Delete
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
