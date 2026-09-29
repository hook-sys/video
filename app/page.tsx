import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Hero } from "@/components/landing/hero";
import { heroPlan } from "@/components/landing/hero-plan";
import { FinalCta, SceneBrand, SceneBrief, SceneDirect } from "@/components/landing/scenes";
import { SoundProvider, SoundToggle } from "@/components/landing/sound";
import { createClient } from "@/lib/supabase/server";
import "@/components/landing/landing.css";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { plan, captions } = heroPlan();

  return (
    <SoundProvider>
      <div className="lp relative flex flex-1 flex-col">
        <header className="lp-nav">
          <Link href="/" className="text-lg" aria-label="MotionBrief home">
            <Logo animated />
          </Link>
          <nav className="lp-nav-links">
            {user ? (
              <Link href="/dashboard" className="lp-nav-cta">
                Dashboard
              </Link>
            ) : (
              <>
                <Link href="/login">Log in</Link>
                <Link href="/signup" className="lp-nav-cta">
                  Sign up
                </Link>
              </>
            )}
          </nav>
        </header>
        <main>
          <Hero signedIn={!!user} plan={plan} captions={captions} />
          <SceneBrief />
          <SceneBrand />
          <SceneDirect />
          <FinalCta signedIn={!!user} />
        </main>
        <footer className="lp-footer">© MotionBrief</footer>
        <SoundToggle />
      </div>
    </SoundProvider>
  );
}
