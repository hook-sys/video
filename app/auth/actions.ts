"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { userAccess } from "@/lib/admin";
import { getSettings } from "@/lib/app-settings";

function credentials(formData: FormData) {
  return {
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  };
}

export async function login(formData: FormData) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(
    credentials(formData),
  );
  if (error) {
    // Auth service down or timing out (502/504): say so plainly.
    const message = (error.status ?? 0) >= 500 ? "Login is temporarily unavailable. Please try again in a minute." : error.message;
    redirect(`/login?error=${encodeURIComponent(message)}`);
  }
  // Suspended from /admin/users.
  if ((await userAccess(supabase, data.user.id)).suspended) {
    await supabase.auth.signOut();
    redirect(`/login?error=${encodeURIComponent("This account is suspended. Contact support.")}`);
  }
  redirect("/dashboard");
}

export async function signup(formData: FormData) {
  const settings = await getSettings();
  if (settings.signups_enabled === false)
    redirect(`/signup?error=${encodeURIComponent("Sign-ups are paused right now. Please try again later.")}`);
  const { email, password } = credentials(formData);
  // (admin settings: whether the email is confirmed first, whether the team approves the account)
  const verify = settings.email_verification === true;
  const approve = settings.require_approval !== false;
  const supabase = await createClient();
  const admin = createAdminClient();
  let id: string | null = null;
  if (verify) {
    const origin = (await headers()).get("origin") ?? "";
    const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${origin}/auth/callback` } });
    if (error) redirect(`/signup?error=${encodeURIComponent(error.message)}`);
    // (an email already registered comes back without identities: nothing new to hold)
    if (data.user?.identities?.length) id = data.user.id;
  } else {
    // ready at once: no email is sent
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) redirect(`/signup?error=${encodeURIComponent("That email doesn't look right.")}`);
    if (password.length < 6) redirect(`/signup?error=${encodeURIComponent("The password needs at least 6 characters.")}`);
    const { data, error } = await admin.auth.admin.createUser({ email: email.trim().toLowerCase(), password, email_confirm: true });
    if (error || !data.user) redirect(`/signup?error=${encodeURIComponent(/already/i.test(error?.message ?? "") ? "This email already has an account. Log in instead." : error?.message ?? "Couldn't create the account.")}`);
    id = data.user!.id;
  }
  // (the profile row is made by the sign-up trigger)
  if (id && approve) await admin.from("profiles").update({ status: "pending" }).eq("id", id);
  if (verify) redirect(`/login?message=${encodeURIComponent("Check your email to confirm your account.")}`);
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error) redirect(`/login?message=${encodeURIComponent("Your account is ready. Log in to continue.")}`);
  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
