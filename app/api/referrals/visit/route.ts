import { NextResponse } from "next/server";
import { createSupabaseAdminClient, getSupabaseAdminConfig } from "@/lib/supabase-admin";

function extractString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export async function POST(request: Request) {
  const adminConfig = getSupabaseAdminConfig();

  if (!adminConfig.hasSupabaseUrl || !adminConfig.hasServiceRoleKey) {
    return NextResponse.json({ error: "Supabase admin access is not configured." }, { status: 503 });
  }

  const payload = await request.json().catch(() => null);
  const code =
    payload && typeof payload === "object"
      ? extractString((payload as Record<string, unknown>).code)
      : null;
  const visitorKey =
    payload && typeof payload === "object"
      ? extractString((payload as Record<string, unknown>).visitorKey)
      : null;
  const userAgent =
    payload && typeof payload === "object"
      ? extractString((payload as Record<string, unknown>).userAgent)
      : null;

  if (!code || !visitorKey) {
    return NextResponse.json({ error: "Invalid referral visit payload." }, { status: 400 });
  }

  const adminSupabase = createSupabaseAdminClient();
  const { data, error } = await adminSupabase.rpc("track_referral_link_visit", {
    p_referral_code: code,
    p_user_agent: userAgent,
    p_visitor_key: visitorKey,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data, ok: true });
}
