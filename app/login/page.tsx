import type { Metadata } from "next";
import { Site } from "@/components/site/site";

export const metadata: Metadata = { title: "Log in" };

// The same page for everyone, made once at build time: whether you are signed
// in, and a message after a try (?error=, ?message=), are read in the browser.
export default function Page() {
  return <Site initial="login" />;
}
