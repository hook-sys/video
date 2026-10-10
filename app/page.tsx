import { Site } from "@/components/site/site";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return <Site initial="overview" signedIn={!!user} />;
}
