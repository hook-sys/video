"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
  if ((await getSettings()).signups_enabled === false)
    redirect(`/signup?error=${encodeURIComponent("Sign-ups are paused right now. Please try again later.")}`);
  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? "";
  const { data, error } = await supabase.auth.signUp({
    ...credentials(formData),
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  if (!data.session) {
    redirect(
      `/login?message=${encodeURIComponent("Check your email to confirm your account.")}`,
    );
  }
  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
