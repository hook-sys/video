"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseContact } from "@/lib/crm";

async function getUserClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

const withError = (path: string, message: string) =>
  redirect(`${path}?error=${encodeURIComponent(message)}`);

export async function createContact(formData: FormData) {
  const parsed = parseContact(formData);
  if (!parsed.data) return withError("/crm", parsed.error);
  const { supabase, user } = await getUserClient();
  const { error } = await supabase
    .from("crm_contacts")
    .insert({ ...parsed.data, user_id: user.id });
  if (error) return withError("/crm", error.message);
  revalidatePath("/crm");
  redirect("/crm");
}

export async function updateContact(id: string, formData: FormData) {
  const parsed = parseContact(formData);
  if (!parsed.data) return withError(`/crm/${id}`, parsed.error);
  const { supabase } = await getUserClient();
  const { error } = await supabase.from("crm_contacts").update(parsed.data).eq("id", id);
  if (error) return withError(`/crm/${id}`, error.message);
  revalidatePath("/crm");
  redirect("/crm");
}

export async function deleteContact(id: string) {
  const { supabase } = await getUserClient();
  await supabase.from("crm_contacts").delete().eq("id", id);
  revalidatePath("/crm");
  redirect("/crm");
}
