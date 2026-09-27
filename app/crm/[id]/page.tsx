import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Contact } from "@/lib/crm";
import { updateContact } from "../actions";
import { ContactForm } from "../contact-form";

export default async function EditContactPage({ params, searchParams }: PageProps<"/crm/[id]">) {
  const [{ id }, { error }] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const { data } = await supabase
    .from("crm_contacts")
    .select("id, name, company, email, phone, notes, status")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-12">
      <Link href="/crm" className="text-sm text-foreground/70 underline">
        ← CRM
      </Link>
      <h1 className="text-2xl font-semibold">Edit contact</h1>
      {typeof error === "string" && <p className="text-sm text-red-600">{error}</p>}
      <ContactForm action={updateContact.bind(null, id)} contact={data as Contact} submitLabel="Save" />
    </main>
  );
}
