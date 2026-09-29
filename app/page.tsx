import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="flex items-center gap-3 text-4xl font-semibold tracking-tight sm:text-5xl">
        <Image src="/icon.svg" alt="" width={48} height={48} priority />
        MotionBrief
      </h1>
      <p className="max-w-xl text-lg text-foreground/70">
        Turn your website or product screenshots into a professional
        motion-graphics promo video for your SaaS, software or digital product.
      </p>
      <Link
        href="/projects/new"
        className="rounded-full bg-foreground px-6 py-3 font-medium text-background transition-opacity hover:opacity-90"
      >
        Create Video
      </Link>
    </main>
  );
}
