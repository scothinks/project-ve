"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { buildConfirmedLoginPath } from "@/lib/auth-confirmation";
import { defaultAuthNextPath, getSafeAuthNextPath } from "@/lib/auth-redirect";
import {
  normalizeEmailInput,
  sanitizePlainTextInput,
} from "@/lib/input-safety";
import {
  contextualReferralStorageKey,
  normalizeReferralInviteKind,
  normalizeReferralInviteToken,
  publicReferralStorageKey,
  referralKindStorageKey,
  type ReferralInviteKind,
} from "@/lib/referral-invites";
import { createSupabaseBrowserClient } from "@/lib/supabase";

import { useSignupCaptcha } from "./use-signup-captcha";
import { serializeCookieHeader } from "@supabase/ssr";
import { sessionPersistenceCookie } from "@/lib/auth-session-persistence";
import { authStorage } from "./storage";

const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const isGoogleAuthEnabled = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true";

type LoginFormProps = {
  isDemoMode: boolean;
  nextPath: string;
  initialMode: "login" | "signup";
  hasWelcomeProgress: boolean;
};

type PendingAction = "submit" | "google" | "forgot" | "resend" | "redirect";

type ReferralAcceptResult = {
  accessStatus?: string;
  destination?: string | null;
};

export function useAccountForm({ isDemoMode, nextPath, initialMode, hasWelcomeProgress }: LoginFormProps) {
  const browserSupabase = useMemo(() => createSupabaseBrowserClient(), []);
  const supabase = isDemoMode ? null : browserSupabase;
  const safeNextPath = getSafeAuthNextPath(nextPath);
  const [authMode, setAuthMode] = useState<"login" | "signup">(initialMode);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [remember, setRemember] = useState(true);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referralKind, setReferralKind] = useState<ReferralInviteKind>("public");
  const [message, setMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);
  const [emailConfirmed, setEmailConfirmed] = useState(false);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [canResendConfirmation, setCanResendConfirmation] = useState(false);
  const { captchaToken, setCaptchaToken, turnstileWidgetId } = useSignupCaptcha(authMode === "signup" && !confirmationEmail && !emailConfirmed);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [initialized, setInitialized] = useState(false);
  const isLoading = !initialized || pendingAction !== null;
  const isRedirecting = pendingAction === "redirect";


  const buildLoginPath = useCallback((params?: Record<string, string>) => {
    const searchParams = new URLSearchParams();

    if (safeNextPath !== defaultAuthNextPath) {
      searchParams.set("next", safeNextPath);
    }

    for (const [key, value] of Object.entries(params ?? {})) {
      searchParams.set(key, value);
    }

    const query = searchParams.toString();
    return query ? `/login?${query}` : "/login";
  }, [safeNextPath]);

  const getOAuthNextPath = useCallback(() => {
    const safeReferralCode = referralCode
      ? normalizeReferralInviteToken(referralCode, referralKind)
      : null;

    if (!safeReferralCode || referralKind !== "contextual") {
      if (safeNextPath === defaultAuthNextPath && safeReferralCode) {
        return `/dashboard?ref=${encodeURIComponent(safeReferralCode)}`;
      }
      return safeNextPath;
    }

    return buildConfirmedLoginPath({
      nextPath: safeNextPath,
      referralCode: safeReferralCode,
      referralKind,
    });
  }, [referralCode, referralKind, safeNextPath]);

  const openDestination = useCallback((destination?: string | null) => {
    const safeDestination = getSafeAuthNextPath(destination, safeNextPath);
    setPendingAction("redirect");
    window.setTimeout(() => {
      window.location.replace(hasWelcomeProgress && !safeDestination.startsWith("/welcome/save") ? `/welcome/save?next=${encodeURIComponent(safeDestination)}` : safeDestination);
    }, 0);
  }, [safeNextPath, hasWelcomeProgress]);

  const resolveReferralDestination = useCallback((result: ReferralAcceptResult | null) => {
    if (!result?.accessStatus) {
      return null;
    }

    if (result.accessStatus === "granted") {
      return getSafeAuthNextPath(result.destination, safeNextPath);
    }

    if (result.accessStatus === "pending") {
      return "/org/my?notice=Access%20requested.%20Waiting%20for%20organisation%20approval.";
    }

    return "/org/my?notice=This%20invite%20could%20not%20grant%20organisation%20access.";
  }, [safeNextPath]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("ref");
    const queryKind = params.get("refKind");
    const storedKind = authStorage.getItem(referralKindStorageKey);
    const hasStoredContextual = Boolean(authStorage.getItem(contextualReferralStorageKey));
    const kind = code
      ? normalizeReferralInviteKind(queryKind)
      : normalizeReferralInviteKind(storedKind ?? (hasStoredContextual ? "contextual" : "public"));
    const storageKey = kind === "contextual" ? contextualReferralStorageKey : publicReferralStorageKey;
    const storedCode = authStorage.getItem(storageKey);
    const safeCode = code ? normalizeReferralInviteToken(code, kind) : null;
    const safeStoredCode = storedCode ? normalizeReferralInviteToken(storedCode, kind) : null;
    const activeCode = safeCode ?? safeStoredCode;

    if (safeCode) {
      authStorage.setItem(referralKindStorageKey, kind);
      authStorage.setItem(storageKey, safeCode);
      authStorage.removeItem(
        kind === "contextual" ? publicReferralStorageKey : contextualReferralStorageKey,
      );
    }

    if (activeCode) {
      setReferralCode(activeCode);
      setReferralKind(kind);
      setAuthMode("signup");
    }

    if (new URLSearchParams(window.location.search).get("reset") === "1") {
      setAuthMode("login");
      setIsPasswordRecovery(true);
      setMessage("Enter your new password below, then save it.");
    }

    if (new URLSearchParams(window.location.search).get("confirmed") === "1") {
      setAuthMode("login");
      setEmailConfirmed(true);
      window.history.replaceState({}, "", buildLoginPath());
    }

    const authError = new URLSearchParams(window.location.search).get("auth_error");
    if (authError) {
      setAuthMode("login");
      setMessage(authError);
      setReferralCode(null);
      authStorage.removeItem(referralKindStorageKey);
      window.history.replaceState({}, "", buildLoginPath());
    }
    setInitialized(true);
  }, [buildLoginPath]);


  async function applyReferralIfNeeded() {
    const storedKind = authStorage.getItem(referralKindStorageKey);
    const kind = referralCode
      ? referralKind
      : normalizeReferralInviteKind(storedKind);
    const storageKey = kind === "contextual" ? contextualReferralStorageKey : publicReferralStorageKey;
    const code = normalizeReferralInviteToken(
      referralCode ?? authStorage.getItem(storageKey) ?? "",
      kind,
    );

    if (!code) {
      return null;
    }

    const response = await fetch("/api/referrals/accept", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        referralCode: code,
        referralKind: kind,
        referredUserHint: normalizeEmailInput(email),
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error ?? "Could not apply referral.");
    }

    const data = (await response.json()) as ReferralAcceptResult;

    authStorage.removeItem(publicReferralStorageKey);
    authStorage.removeItem(contextualReferralStorageKey);
    authStorage.removeItem(referralKindStorageKey);

    return kind === "contextual" ? resolveReferralDestination(data) : null;
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setConfirmationEmail(null);
    setSuccessMessage(null);
    setCanResendConfirmation(false);

    if (isPasswordRecovery) {
      await handleSaveNewPassword();
      return;
    }

    if (!supabase) {
      if (!isDemoMode) {
        setMessage("Login is unavailable until the live backend is configured.");
        return;
      }

      setPendingAction("submit");
      setMessage(null);
      if (authMode === "signup") {
        try {
          const referralDestination = await applyReferralIfNeeded();
          openDestination(referralDestination);
          return;
        } catch (error) {
          setPendingAction(null);
          setMessage(error instanceof Error ? error.message : "Could not apply referral.");
          return;
        }
      }
      openDestination();
      return;
    }

    if (authMode === "signup" && password.length < 8) {
      setMessage("Password must be at least 8 characters.");
      return;
    }

    setPendingAction("submit");
    setMessage(null);

    const safeEmail = normalizeEmailInput(email);
    const safeFullName = sanitizePlainTextInput(fullName, 120).trim();
    const safeReferralCode = referralCode
      ? normalizeReferralInviteToken(referralCode, referralKind)
      : null;

    if (authMode === "signup") {
      if (safeFullName.length < 2) {
        setPendingAction(null);
        setMessage("Enter your name.");
        return;
      }

      if (!acceptedTerms) {
        setPendingAction(null);
        setMessage("Accept the Terms before creating an account.");
        return;
      }

      if (turnstileSiteKey && !captchaToken) {
        setPendingAction(null);
        setMessage("Complete the signup check and try again.");
        return;
      }

      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: safeEmail,
          password,
          fullName: safeFullName,
          captchaToken,
          nextPath: safeNextPath,
          referralCode: safeReferralCode,
          referralKind,
        }),
      });
      const data = (await response.json()) as {
        email?: string;
        error?: string;
        sessionExists?: boolean;
      };

      if (!response.ok) {
        setPendingAction(null);
        window.turnstile?.reset(turnstileWidgetId ?? undefined);
        setCaptchaToken(null);
        setMessage(data.error ?? "Could not create account.");
        return;
      }

      if (data.sessionExists) {
        try {
          const referralDestination = await applyReferralIfNeeded();
          openDestination(referralDestination);
          return;
        } catch (referralError) {
          setMessage(
            referralError instanceof Error
              ? referralError.message
              : "Account created, but referral could not be applied.",
          );
          setPendingAction(null);
          return;
        }
      }

      setPendingAction(null);
      setConfirmationEmail(data.email ?? safeEmail);
      return;
    }

    document.cookie = serializeCookieHeader(sessionPersistenceCookie, remember ? "persistent" : "session", {path: "/", sameSite: "lax", secure: location.protocol === "https:", maxAge: 60*60*24*365});
    const { error } = await supabase.auth.signInWithPassword({
      email: safeEmail,
      password,
    });

    if (error) {
      setPendingAction(null);
      setMessage(error.message);
      setCanResendConfirmation(error.message.toLowerCase().includes("email not confirmed"));
      return;
    }

    try {
      const referralDestination = await applyReferralIfNeeded();
      openDestination(referralDestination);
    } catch (referralError) {
      setMessage(referralError instanceof Error ? referralError.message : "Could not apply referral.");
      setPendingAction(null);
    }
  }

  async function handleGoogleLogin() {
    if (!isGoogleAuthEnabled) {
      setMessage("Google login is not available right now.");
      return;
    }

    if (!supabase) {
      if (!isDemoMode) {
        setMessage("Google login is unavailable until the live backend is configured.");
        return;
      }

      setPendingAction("google");
      setMessage(null);
      setSuccessMessage(null);
      openDestination();
      return;
    }

    setPendingAction("google");
    setMessage(null);
    setSuccessMessage(null);

    if (authMode === "signup" && !acceptedTerms) {
      setPendingAction(null);
      setMessage("Accept the Terms before creating an account.");
      return;
    }

    if (authMode === "signup" && turnstileSiteKey) {
      if (!captchaToken) {
        setPendingAction(null);
        setMessage("Complete the signup check and try again.");
        return;
      }

      const response = await fetch("/api/auth/oauth-signup/prepare", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          captchaToken,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setPendingAction(null);
        window.turnstile?.reset(turnstileWidgetId ?? undefined);
        setCaptchaToken(null);
        setMessage(data.error ?? "Could not start Google signup.");
        return;
      }
    }

    document.cookie = serializeCookieHeader(sessionPersistenceCookie, authMode === "signup" || remember ? "persistent" : "session", {path: "/", sameSite: "lax", secure: location.protocol === "https:", maxAge: 60*60*24*365});
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
          getOAuthNextPath(),
        )}`,
      },
    });

    if (error) {
      setPendingAction(null);
      setMessage(error.message);
    }
  }

  async function handleForgotPassword() {
    const safeEmail = normalizeEmailInput(email);

    if (!safeEmail) {
      setMessage("Enter your email address first.");
      return;
    }

    if (!supabase) {
      if (!isDemoMode) {
        setMessage("Password reset is unavailable until the live backend is configured.");
        return;
      }

      setSuccessMessage("Password reset email sent.");
      return;
    }

    setPendingAction("forgot");
    setMessage(null);
    setSuccessMessage(null);

    const { error } = await supabase.auth.resetPasswordForEmail(safeEmail, {
      redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
        buildLoginPath({ reset: "1" }),
      )}`,
    });

    setPendingAction(null);

    if (error) {
      setMessage(error.message);
      return;
    }

    setSuccessMessage("Password reset email sent. Check your inbox.");
  }

  async function handleResendConfirmation() {
    const safeEmail = normalizeEmailInput(email);

    if (!safeEmail) {
      setMessage("Enter your email address first.");
      return;
    }

    if (!supabase) {
      if (!isDemoMode) {
        setMessage("Confirmation email is unavailable until the live backend is configured.");
        return;
      }

      setSuccessMessage("Confirmation email sent.");
      setCanResendConfirmation(false);
      return;
    }

    setPendingAction("resend");
    setMessage(null);
    setSuccessMessage(null);

    const { error } = await supabase.auth.resend({
      type: "signup",
      email: safeEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
          buildConfirmedLoginPath({
            nextPath: safeNextPath,
            referralCode,
            referralKind,
          }),
        )}`,
      },
    });

    setPendingAction(null);

    if (error) {
      setMessage(error.message);
      return;
    }

    setCanResendConfirmation(false);
    setSuccessMessage("Confirmation email sent. Check your inbox.");
  }

  async function handleSaveNewPassword() {
    if (!supabase) {
      if (!isDemoMode) {
        setMessage("Password updates are unavailable until the live backend is configured.");
        return;
      }

      setSuccessMessage("Password updated.");
      return;
    }

    if (password.length < 8) {
      setMessage("Password must be at least 8 characters.");
      return;
    }

    setPendingAction("submit");
    setMessage(null);
    setSuccessMessage(null);

    const { error } = await supabase.auth.updateUser({ password });

    setPendingAction(null);

    if (error) {
      setMessage(error.message);
      return;
    }

    setPassword("");
    setIsPasswordRecovery(false);
    setAuthMode("login");
    setSuccessMessage("Password updated. You can now log in.");
    window.history.replaceState({}, "", buildLoginPath());
  }

  async function run(action: () => Promise<void>) {
    try { await action(); } catch { setPendingAction(null); setMessage("We couldn’t connect. Check your connection and try again."); }
  }
  function switchMode(mode: "login" | "signup") {
    setAuthMode(mode); setIsPasswordRecovery(false); setEmailConfirmed(false); setConfirmationEmail(null);
    setPassword(""); setShowPassword(false); setMessage(null); setSuccessMessage(null); setCanResendConfirmation(false);
    window.history.replaceState({}, "", buildLoginPath({mode}));
  }
  return {authMode, switchMode, fullName, setFullName, email, setEmail, password, setPassword,
    showPassword, setShowPassword, acceptedTerms, setAcceptedTerms, remember, setRemember,
    referralCode, referralKind, message, successMessage, confirmationEmail, emailConfirmed,
    isPasswordRecovery, canResendConfirmation, pendingAction, isLoading, isRedirecting,
    turnstileSiteKey, isGoogleAuthEnabled, isDemoMode, safeNextPath,
    submit: (event: FormEvent<HTMLFormElement>) => run(() => handleLogin(event)),
    google: () => run(handleGoogleLogin), forgot: () => run(handleForgotPassword),
    resend: () => run(handleResendConfirmation),
  };
}
export type AccountFormController = ReturnType<typeof useAccountForm>;
