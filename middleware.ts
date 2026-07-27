import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase";

function shouldRefreshAuthSession(pathname: string) {
  return (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/notifications") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/admin") ||
    pathname.startsWith("/api/notifications") ||
    pathname.startsWith("/api/rewards") ||
    pathname.startsWith("/api/quizzes") ||
    pathname.startsWith("/api/missions") ||
    pathname.startsWith("/api/lesson-progress")
  );
}

function ensureDeviceCookie(request: NextRequest, response: NextResponse) {
  const deviceCookieName = "project-ve-device-id";

  if (!request.cookies.get(deviceCookieName)?.value) {
    response.cookies.set(deviceCookieName, crypto.randomUUID(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
  }
}

export async function middleware(request: NextRequest) {
  if (!supabaseUrl || !supabasePublishableKey) {
    const response = NextResponse.next({ request });
    ensureDeviceCookie(request, response);
    return response;
  }

  let response = NextResponse.next({ request });

  if (!shouldRefreshAuthSession(request.nextUrl.pathname)) {
    ensureDeviceCookie(request, response);
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  await supabase.auth.getUser();
  ensureDeviceCookie(request, response);

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
