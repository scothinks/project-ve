import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { normalizeEmailInput, sanitizePlainTextInput } from "@/lib/input-safety";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createPlainSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";

type SignupBody = {
  email?: string;
  password?: string;
  fullName?: string;
  captchaToken?: string | null;
};

function getIpAddress(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

function hashRiskValue(value: string | null | undefined) {
  if (!value || value === "unknown") {
    return null;
  }

  const salt = process.env.FRAUD_HASH_SALT ?? "project-ve-local-risk-salt";
  return createHash("sha256").update(`${salt}:${value}`).digest("hex");
}

async function verifyCaptcha(token: string | null | undefined, ipAddress: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    return true;
  }

  if (!token) {
    return false;
  }

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      secret,
      response: token,
      remoteip: ipAddress,
    }),
  });
  const data = (await response.json()) as { success?: boolean };

  return Boolean(data.success);
}

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

  const ipAddress = getIpAddress(request);
  const deviceId = request.cookies.get("project-ve-device-id")?.value ?? null;
  const ipHash = hashRiskValue(ipAddress);
  const deviceHash = hashRiskValue(deviceId);
  const emailDomain = email.split("@")[1] ?? "";
  const captchaPassed = await verifyCaptcha(body.captchaToken, ipAddress);

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
