import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

// Only the signed-in pages: the landing page, log in, start free and the
// legal pages are the same for everyone and served ready-made, with no call
// to Supabase on the way.
export const config = {
  matcher: ["/dashboard/:path*", "/projects/:path*", "/admin/:path*", "/billing/:path*", "/brand/:path*"],
};
