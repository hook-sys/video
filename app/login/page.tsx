import type { Metadata } from "next";
import { Site } from "@/components/site/site";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error, message } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return <Site initial="login" signedIn={!!user} error={typeof error === "string" ? error : undefined} message={typeof message === "string" ? message : undefined} />;
}
