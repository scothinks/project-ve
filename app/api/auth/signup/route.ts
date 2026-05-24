import { NextRequest, NextResponse } from "next/server";
import { normalizeEmailInput, sanitizePlainTextInput } from "@/lib/input-safety";
import { getRiskContext, verifyTurnstileToken } from "@/lib/auth-risk";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createPlainSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";

type SignupBody = {
  email?: string;
  password?: string;
  fullName?: string;
  captchaToken?: string | null;
};

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as SignupBody;
  const email = normalizeEmailInput(body.email ?? "");
  const password = body.password ?? "";
  const fullName = sanitizePlainTextInput(body.fullName ?? "", 120).trim();

  if (!email) {
    return NextResponse.json({ error: "Email address is required." }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 },
    );
  }

  if (fullName.length < 2) {
    return NextResponse.json({ error: "Enter your name." }, { status: 400 });
  }

  if (!isSupabaseConfigured) {
    return NextResponse.json({ email, sessionExists: true });
  }

  const { ipAddress, ipHash, deviceHash } = getRiskContext(request);
  const emailDomain = email.split("@")[1] ?? "";
  const captchaPassed = await verifyTurnstileToken(body.captchaToken, ipAddress);

  if (!captchaPassed) {
    return NextResponse.json(
      { error: "Please complete the signup check and try again." },
      { status: 400 },
    );
  }

  const plainSupabase = createPlainSupabaseClient();
  const serverSupabase = await createSupabaseServerClient();

  if (!plainSupabase || !serverSupabase) {
    return NextResponse.json({ error: "Auth is not configured." }, { status: 500 });
  }

  const { error: attemptError } = await plainSupabase.rpc("record_signup_attempt", {
    p_email_domain: emailDomain,
    p_ip_hash: ipHash,
    p_device_hash: deviceHash,
    p_captcha_passed: captchaPassed,
  });

  if (attemptError) {
    return NextResponse.json({ error: attemptError.message }, { status: 400 });
  }

  const { data, error } = await serverSupabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${request.nextUrl.origin}/auth/callback?next=${encodeURIComponent(
        "/login?confirmed=1",
      )}`,
      data: {
        display_name: fullName,
        full_name: fullName,
        name: fullName,
        captcha_passed: captchaPassed,
        signup_device_hash: deviceHash,
        signup_ip_hash: ipHash,
      },
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    email,
    sessionExists: Boolean(data.session),
  });
}
