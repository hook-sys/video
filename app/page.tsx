import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { heroPlan } from "@/components/landing/hero-plan";
import { HeroPlayer } from "@/components/landing/hero-player";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { plan, captions } = heroPlan();

  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="text-lg" aria-label="MotionBrief home">
          <Logo animated />
        </Link>
        <nav className="flex items-center gap-2 text-sm font-medium">
          {user ? (
            <Link href="/dashboard" className="rounded-full bg-foreground px-4 py-2 text-background transition-opacity hover:opacity-90">
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="rounded-full px-4 py-2 text-foreground/80 transition-colors hover:text-foreground">
                Log in
              </Link>
              <Link href="/signup" className="rounded-full bg-foreground px-4 py-2 text-background transition-opacity hover:opacity-90">
                Sign up
              </Link>
            </>
          )}
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center gap-8 px-4 pt-6 pb-16 text-center sm:px-6 sm:pt-10">
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">
            Your brief, <span className="bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">in motion.</span>
          </h1>
          <p className="max-w-xl text-lg text-foreground/70">A motion-graphics promo video for your product, made from a short brief.</p>
          <Link
            href={user ? "/projects/new" : "/signup"}
            className="mt-2 rounded-full bg-foreground px-6 py-3 font-medium text-background transition-opacity hover:opacity-90"
          >
            {user ? "Create video" : "Start free"}
          </Link>
        </div>
        <HeroPlayer plan={plan} captions={captions} />
      </main>
    </div>
  );
}
