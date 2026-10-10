import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PATHS = ["/dashboard", "/projects", "/admin", "/billing", "/pending"];
// (an account waiting for the team's approval sees only /pending)
const CUSTOMER_PATHS = ["/dashboard", "/projects", "/billing"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refreshes the session; must run before any redirect decision.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  if (!user && PROTECTED_PATHS.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (user && CUSTOMER_PATHS.some((p) => pathname.startsWith(p))) {
    const { data } = await supabase.from("profiles").select("status").eq("id", user.id).maybeSingle();
    if (data?.status === "pending") {
      const url = request.nextUrl.clone();
      url.pathname = "/pending";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return response;
}
