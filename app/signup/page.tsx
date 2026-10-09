import type { Metadata } from "next";
import { Site } from "@/components/site/site";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Start free" };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return <Site initial="signup" signedIn={!!user} error={typeof error === "string" ? error : undefined} />;
}
