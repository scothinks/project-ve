import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isDemoMode } from "@/lib/app-mode";
import {
  isProtectedLearnerRoutePath,
  shouldRefreshAuthInMiddleware,
  VERIFIED_AUTH_REQUEST_HEADER,
  VERIFIED_AUTH_USER_EMAIL_HEADER,
  VERIFIED_AUTH_USER_ID_HEADER,
} from "@/lib/route-auth-policy";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase";

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
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete(VERIFIED_AUTH_REQUEST_HEADER);
  requestHeaders.delete(VERIFIED_AUTH_USER_ID_HEADER);
  requestHeaders.delete(VERIFIED_AUTH_USER_EMAIL_HEADER);
  const createNextResponse = () => NextResponse.next({
    request: { headers: requestHeaders },
  });

  if (isDemoMode || !supabaseUrl || !supabasePublishableKey) {
    const response = createNextResponse();
    ensureDeviceCookie(request, response);
    return response;
  }

  if (!shouldRefreshAuthInMiddleware(request.nextUrl.pathname)) {
    const response = createNextResponse();
    ensureDeviceCookie(request, response);
    return response;
  }

  let response = createNextResponse();

  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        requestHeaders.set("cookie", request.cookies.toString());
        response = createNextResponse();
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const authStartedAt = performance.now();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (process.env.PERF_LOGS === "1") {
    console.info(`[perf] middleware.auth_current_user ${Math.round(performance.now() - authStartedAt)}ms`);
  }

  const refreshedResponse = (() => {
    requestHeaders.set(VERIFIED_AUTH_REQUEST_HEADER, user ? "1" : "0");
    if (user) {
      requestHeaders.set(VERIFIED_AUTH_USER_ID_HEADER, user.id);
      if (user.email) {
        requestHeaders.set(VERIFIED_AUTH_USER_EMAIL_HEADER, user.email);
      }
    }
    return createNextResponse();
  })();
  response.cookies.getAll().forEach((cookie) => refreshedResponse.cookies.set(cookie));
  response = refreshedResponse;

  ensureDeviceCookie(request, response);

  if (!user && isProtectedLearnerRoutePath(request.nextUrl.pathname)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    for (const key of ["ref", "refKind"]) {
      const value = request.nextUrl.searchParams.get(key);

      if (value) {
        loginUrl.searchParams.set(key, value);
      }
    }
    const redirectResponse = NextResponse.redirect(loginUrl);
    ensureDeviceCookie(request, redirectResponse);
    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
