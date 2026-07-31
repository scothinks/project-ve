import { NextRequest, NextResponse } from "next/server";
import { normalizeEmailInput, sanitizePlainTextInput } from "@/lib/input-safety";
import { getRiskContext, verifyTurnstileToken } from "@/lib/auth-risk";
import {
  getOptionalStringField,
  getStringField,
  readJsonObject,
  validationErrorResponse,
  type ValidationIssue,
} from "@/lib/request-validation";
import { isDemoMode } from "@/lib/app-mode";
import { assertRequiredSecurityEnv } from "@/lib/security-env";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createPlainSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import { nullableRpcText } from "@/lib/supabase-rpc";

export async function POST(request: NextRequest) {
  assertRequiredSecurityEnv("password signup");

  const bodyResult = await readJsonObject(request);

  if (!bodyResult.ok) {
    return validationErrorResponse(bodyResult.issues);
  }

  const issues: ValidationIssue[] = [];
  const rawEmail = getStringField(bodyResult.data, "email", issues);
  const password = getStringField(bodyResult.data, "password", issues, { minLength: 8 });
  const rawFullName = getStringField(bodyResult.data, "fullName", issues, { minLength: 2 });
  const captchaToken = getOptionalStringField(bodyResult.data, "captchaToken", issues);
  const email = normalizeEmailInput(rawEmail ?? "");
  const fullName = sanitizePlainTextInput(rawFullName ?? "", 120).trim();

  if (!email) {
    issues.push({ path: "email", message: "Expected a valid email address." });
  }

  if (issues.length > 0 || !password || !fullName) {
    return validationErrorResponse(issues);
  }

  if (isDemoMode) {
    return NextResponse.json({ email, sessionExists: true });
  }

  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: "Account creation is unavailable until the live backend is configured." },
      { status: 503 },
    );
  }

  const { ipAddress, ipHash, deviceHash } = getRiskContext(request);
  const emailDomain = email.split("@")[1] ?? "";
  const captchaPassed = await verifyTurnstileToken(captchaToken, ipAddress);

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
    p_ip_hash: nullableRpcText(ipHash),
    p_device_hash: nullableRpcText(deviceHash),
    p_captcha_passed: captchaPassed,
  });

  if (attemptError) {
    return NextResponse.json({ error: attemptError.message }, { status: 400 });
  }

  const { data, error } = await serverSupabase.auth.signUp({
    email,
    password,
    options: {
      captchaToken: captchaToken ?? undefined,
      emailRedirectTo: `${request.nextUrl.origin}/auth/callback?next=${encodeURIComponent(
        "/login?confirmed=1",
      )}`,
      data: {
        display_name: fullName,
        full_name: fullName,
        name: fullName,
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
