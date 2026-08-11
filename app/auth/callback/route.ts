import { NextRequest, NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { getSafeAuthNextPath } from "@/lib/auth-redirect";
import { getRiskContext } from "@/lib/auth-risk";
import { normalizeReferralInviteKind, normalizeReferralInviteToken } from "@/lib/referral-invites";
import { createSupabaseAdminClient, getSupabaseAdminConfig } from "@/lib/supabase-admin";
import {
  clearOAuthSignupProofCookie,
  readOAuthSignupProofCookie,
} from "@/lib/oauth-signup-proof";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { nullableRpcText } from "@/lib/supabase-rpc";

type ProfileFraudFlagsRow = {
  fraud_flags: Record<string, unknown> | null;
};

type ProfileAccessRow = {
  role: "learner" | "admin";
};

type UserValueProfileStatusRow = {
  assessment_completed_at: string | null;
};

type ReferralAcceptResult = {
  accessStatus?: string;
  destination?: string | null;
};

const freshOAuthWindowMs = 5 * 60 * 1000;

function getSafeNextUrl(request: NextRequest) {
  return getSafeAuthNextPath(request.nextUrl.searchParams.get("next"));
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

function getReferralFromNextPath(next: string) {
  const nextUrl = new URL(next, "https://project-ve.local");
  const ref = nextUrl.searchParams.get("ref");
  const kind = normalizeReferralInviteKind(nextUrl.searchParams.get("refKind"));
  const token = ref ? normalizeReferralInviteToken(ref, kind) : "";

  return token ? { kind, token } : null;
}

function getReferralRedirectPath(result: ReferralAcceptResult, fallback: string) {
  if (result.accessStatus === "granted") {
    return getSafeAuthNextPath(result.destination, fallback);
  }

  if (result.accessStatus === "pending") {
    return "/org/my?notice=Access%20requested.%20Waiting%20for%20organisation%20approval.";
  }

  return "/org/my?notice=This%20invite%20could%20not%20grant%20organisation%20access.";
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
      .maybeSingle();
    const typedProfile = profile as ProfileFraudFlagsRow | null;
    const fraudFlags = typedProfile?.fraud_flags ?? {};
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
        p_ip_hash: nullableRpcText(ipHash),
        p_device_hash: nullableRpcText(deviceHash),
        p_captcha_passed: true,
      });

      if (attemptError) {
        return rejectNewGoogleSignup(request, user.id, attemptError.message, supabase);
      }

      const { error: finalizeError } = await supabase.rpc("finalize_oauth_signup", {
        p_ip_hash: nullableRpcText(ipHash),
        p_device_hash: nullableRpcText(deviceHash),
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

  const referral = getReferralFromNextPath(next);

  if (referral) {
    const { data, error } = referral.kind === "contextual"
      ? await supabase.rpc("accept_contextual_referral", {
          p_token: referral.token,
        })
      : await supabase.rpc("accept_referral", {
          p_referral_code: referral.token,
        });

    if (error) {
      const response = NextResponse.redirect(
        new URL("/org/my?notice=This%20invite%20could%20not%20be%20applied.", request.url),
      );
      clearOAuthSignupProofCookie(response);
      return response;
    }

    const destination = referral.kind === "contextual"
      ? getReferralRedirectPath((data ?? {}) as ReferralAcceptResult, next)
      : next;
    const response = NextResponse.redirect(new URL(destination, request.url));
    clearOAuthSignupProofCookie(response);
    return response;
  }

  const [{ data: profile }, { data: valueProfile }] = await Promise.all([
    supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("user_value_profiles")
      .select("assessment_completed_at")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);
  const typedProfile = profile as ProfileAccessRow | null;
  const typedValueProfile = valueProfile as UserValueProfileStatusRow | null;

  const shouldRouteToAssessment =
    typedProfile?.role !== "admin"
    && !typedValueProfile?.assessment_completed_at
    && next !== "/onboarding/assessment";

  const destination = shouldRouteToAssessment ? "/onboarding/assessment" : next;
  const response = NextResponse.redirect(new URL(destination, request.url));
  clearOAuthSignupProofCookie(response);
  return response;
}
