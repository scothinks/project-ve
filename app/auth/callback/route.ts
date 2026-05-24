import { NextRequest, NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { getRiskContext } from "@/lib/auth-risk";
import { createSupabaseAdminClient, getSupabaseAdminConfig } from "@/lib/supabase-admin";
import {
  clearOAuthSignupProofCookie,
  readOAuthSignupProofCookie,
} from "@/lib/oauth-signup-proof";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type ProfileFraudFlagsRow = {
  fraud_flags: Record<string, unknown> | null;
};

const freshOAuthWindowMs = 5 * 60 * 1000;

function getSafeNextUrl(request: NextRequest) {
  const next = request.nextUrl.searchParams.get("next");

  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/dashboard";
  }

  return next;
}

function createLoginRedirect(request: NextRequest, message: string) {
  const errorUrl = new URL("/login", request.url);
  errorUrl.searchParams.set("auth_error", message);
  return errorUrl;
}

function getUserProvider(user: User) {
  const directProvider = user.app_metadata?.provider;

  if (typeof directProvider === "string") {
    return directProvider;
  }

  const providers = user.app_metadata?.providers;

  if (Array.isArray(providers) && typeof providers[0] === "string") {
    return providers[0];
  }

  return null;
}

function isLikelyFreshOAuthUser(user: User) {
  const createdAt = Date.parse(user.created_at ?? "");

  if (!Number.isFinite(createdAt)) {
    return false;
  }

  const lastSignInAt = Date.parse(user.last_sign_in_at ?? "");
  const createdRecently = Date.now() - createdAt <= freshOAuthWindowMs;
  const firstSessionGap =
    !Number.isFinite(lastSignInAt) || Math.abs(lastSignInAt - createdAt) <= freshOAuthWindowMs;

  return createdRecently && firstSessionGap;
}

async function deleteUserIfPossible(userId: string) {
  const adminConfig = getSupabaseAdminConfig();

  if (!adminConfig.hasSupabaseUrl || !adminConfig.hasServiceRoleKey) {
    return;
  }

  const adminSupabase = createSupabaseAdminClient();
  await adminSupabase.auth.admin.deleteUser(userId);
}

async function rejectNewGoogleSignup(
  request: NextRequest,
  userId: string,
  message: string,
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
) {
  await supabase.auth.signOut().catch(() => undefined);
  await deleteUserIfPossible(userId).catch(() => undefined);

  const response = NextResponse.redirect(createLoginRedirect(request, message));
  clearOAuthSignupProofCookie(response);
  return response;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = getSafeNextUrl(request);
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return NextResponse.redirect(new URL(next, request.url));
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return NextResponse.redirect(createLoginRedirect(request, error.message));
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL(next, request.url));
  }

  const provider = getUserProvider(user);

  if (provider === "google") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("fraud_flags")
      .eq("id", user.id)
      .maybeSingle<ProfileFraudFlagsRow>();
    const fraudFlags = profile?.fraud_flags ?? {};
    const alreadyVerified = typeof fraudFlags.oauthGoogleSignupVerifiedAt === "string";

    if (!alreadyVerified && isLikelyFreshOAuthUser(user)) {
      const proof = readOAuthSignupProofCookie(request);
      const { ipHash, deviceHash } = getRiskContext(request);
      const hasMatchingProof =
        proof?.ipHash === ipHash &&
        proof?.deviceHash === deviceHash;

      if (!hasMatchingProof) {
        return rejectNewGoogleSignup(
          request,
          user.id,
          "Please complete the signup check before using Google signup.",
          supabase,
        );
      }

      const emailDomain = user.email?.split("@")[1] ?? "";
      const { error: attemptError } = await supabase.rpc("record_signup_attempt", {
        p_email_domain: emailDomain,
        p_ip_hash: ipHash,
        p_device_hash: deviceHash,
        p_captcha_passed: true,
      });

      if (attemptError) {
        return rejectNewGoogleSignup(request, user.id, attemptError.message, supabase);
      }

      const { error: finalizeError } = await supabase.rpc("finalize_oauth_signup", {
        p_ip_hash: ipHash,
        p_device_hash: deviceHash,
        p_captcha_passed: true,
      });

      if (finalizeError) {
        return rejectNewGoogleSignup(
          request,
          user.id,
          "Could not complete Google signup. Please try again.",
          supabase,
        );
      }
    }
  }

  const response = NextResponse.redirect(new URL(next, request.url));
  clearOAuthSignupProofCookie(response);
  return response;
}
