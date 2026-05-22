import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

function getSafeNextUrl(request: NextRequest) {
  const next = request.nextUrl.searchParams.get("next");

  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/dashboard";
  }

  return next;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = getSafeNextUrl(request);

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = supabase
      ? await supabase.auth.exchangeCodeForSession(code)
      : { error: null };

    if (error) {
      const errorUrl = new URL("/login", request.url);
      errorUrl.searchParams.set("auth_error", error.message);
      return NextResponse.redirect(errorUrl);
    }
  }

  return NextResponse.redirect(new URL(next, request.url));
}
