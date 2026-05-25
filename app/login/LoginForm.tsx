"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  normalizeEmailInput,
  normalizeReferralCodeInput,
  sanitizePlainTextInput,
} from "@/lib/input-safety";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";

const referralStorageKey = "project-ve-referral-code";
const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const isGoogleAuthEnabled = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true";

type AuthView = {
  title: string;
  subtitle: string;
};

type LoginFormProps = {
  onViewChange?: (view: AuthView) => void;
};

declare global {
  interface Window {
    turnstile?: {
      render: (
        selector: string,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback": () => void;
          "error-callback": () => void;
        },
      ) => string;
      reset: (widgetId?: string) => void;
    };
  }
}

export function LoginForm({ onViewChange }: LoginFormProps) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [remember, setRemember] = useState(true);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);
  const [emailConfirmed, setEmailConfirmed] = useState(false);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [canResendConfirmation, setCanResendConfirmation] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [turnstileWidgetId, setTurnstileWidgetId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("ref");
    const storedCode = window.localStorage.getItem(referralStorageKey);
    const safeCode = code ? normalizeReferralCodeInput(code) : null;
    const safeStoredCode = storedCode ? normalizeReferralCodeInput(storedCode) : null;
    const activeCode = safeCode ?? safeStoredCode;

    if (safeCode) {
      window.localStorage.setItem(referralStorageKey, safeCode);
    }

    if (activeCode) {
      setReferralCode(activeCode);
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
      setReferralCode(null);
      window.localStorage.removeItem(referralStorageKey);
      window.history.replaceState({}, "", "/login");
    }

    const authError = new URLSearchParams(window.location.search).get("auth_error");
    if (authError) {
      setAuthMode("login");
      setMessage(authError);
      setReferralCode(null);
      window.history.replaceState({}, "", "/login");
    }
  }, []);

  useEffect(() => {
    const siteKey = turnstileSiteKey;

    if (!siteKey || authMode !== "signup" || turnstileWidgetId) {
      return;
    }

    function renderTurnstile() {
      if (!window.turnstile || turnstileWidgetId) {
        return;
      }

      const widgetId = window.turnstile.render("#project-ve-turnstile", {
        sitekey: siteKey as string,
        callback: (token) => setCaptchaToken(token),
        "expired-callback": () => setCaptchaToken(null),
        "error-callback": () => setCaptchaToken(null),
      });
      setTurnstileWidgetId(widgetId);
    }

    const scriptId = "project-ve-turnstile-script";

    if (!document.getElementById(scriptId)) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.onload = renderTurnstile;
      document.body.appendChild(script);
      return;
    }

    renderTurnstile();
  }, [authMode, turnstileWidgetId]);

  useEffect(() => {
    if (!onViewChange) {
      return;
    }

    if (confirmationEmail) {
      onViewChange({
        title: "Check your email",
        subtitle: "Confirm your account, then come back to continue.",
      });
      return;
    }

    if (emailConfirmed) {
      onViewChange({
        title: "Email confirmed",
        subtitle: "Your account is ready.",
      });
      return;
    }

    if (isPasswordRecovery) {
      onViewChange({
        title: "Reset password",
        subtitle: "Enter your new password below.",
      });
      return;
    }

    if (authMode === "signup") {
      onViewChange({
        title: "Create account",
        subtitle: "Enter your details to create your account.",
      });
      return;
    }

    onViewChange({
      title: "Login",
      subtitle: "Enter your email address to login.",
    });
  }, [authMode, confirmationEmail, emailConfirmed, isPasswordRecovery, onViewChange]);

  async function applyReferralIfNeeded() {
    const code = normalizeReferralCodeInput(
      referralCode ?? window.localStorage.getItem(referralStorageKey) ?? "",
    );

    if (!code) {
      return;
    }

    const response = await fetch("/api/referrals/accept", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        referralCode: code,
        referredUserHint: normalizeEmailInput(email),
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error ?? "Could not apply referral.");
    }

    window.localStorage.removeItem(referralStorageKey);
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
      if (authMode === "signup") {
        try {
          await applyReferralIfNeeded();
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "Could not apply referral.");
          return;
        }
      }
      router.push("/dashboard");
      return;
    }

    if (authMode === "signup" && password.length < 8) {
      setMessage("Password must be at least 8 characters.");
      return;
    }

    setIsLoading(true);
    setMessage(null);

    const safeEmail = normalizeEmailInput(email);
    const safeFullName = sanitizePlainTextInput(fullName, 120).trim();

    if (authMode === "signup") {
      if (safeFullName.length < 2) {
        setIsLoading(false);
        setMessage("Enter your name.");
        return;
      }

      if (!acceptedTerms) {
        setIsLoading(false);
        setMessage("Accept the Terms before creating an account.");
        return;
      }

      if (turnstileSiteKey && !captchaToken) {
        setIsLoading(false);
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
        }),
      });
      const data = (await response.json()) as {
        email?: string;
        error?: string;
        sessionExists?: boolean;
      };

      setIsLoading(false);

      if (!response.ok) {
        window.turnstile?.reset(turnstileWidgetId ?? undefined);
        setCaptchaToken(null);
        setMessage(data.error ?? "Could not create account.");
        return;
      }

      if (data.sessionExists) {
        try {
          await applyReferralIfNeeded();
        } catch (referralError) {
          setMessage(
            referralError instanceof Error
              ? referralError.message
              : "Account created, but referral could not be applied.",
          );
          return;
        }
        router.push("/dashboard");
        return;
      }

      setConfirmationEmail(data.email ?? safeEmail);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: safeEmail,
      password,
    });

    setIsLoading(false);
    if (error) {
      setMessage(error.message);
      setCanResendConfirmation(error.message.toLowerCase().includes("email not confirmed"));
      return;
    }

    router.push("/dashboard");
  }

  async function handleGoogleLogin() {
    if (!isGoogleAuthEnabled) {
      setMessage("Google login is not available right now.");
      return;
    }

    if (!supabase) {
      router.push("/dashboard");
      return;
    }

    setIsLoading(true);
    setMessage(null);
    setSuccessMessage(null);

    if (authMode === "signup" && !acceptedTerms) {
      setIsLoading(false);
      setMessage("Accept the Terms before creating an account.");
      return;
    }

    if (authMode === "signup" && turnstileSiteKey) {
      if (!captchaToken) {
        setIsLoading(false);
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
        setIsLoading(false);
        window.turnstile?.reset(turnstileWidgetId ?? undefined);
        setCaptchaToken(null);
        setMessage(data.error ?? "Could not start Google signup.");
        return;
      }
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
          `/dashboard${
            referralCode ? `?ref=${encodeURIComponent(normalizeReferralCodeInput(referralCode))}` : ""
          }`,
        )}`,
      },
    });

    if (error) {
      setIsLoading(false);
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
      setSuccessMessage("Password reset email sent.");
      return;
    }

    setIsLoading(true);
    setMessage(null);
    setSuccessMessage(null);

    const { error } = await supabase.auth.resetPasswordForEmail(safeEmail, {
      redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
        "/login?reset=1",
      )}`,
    });

    setIsLoading(false);

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
      setSuccessMessage("Confirmation email sent.");
      setCanResendConfirmation(false);
      return;
    }

    setIsLoading(true);
    setMessage(null);
    setSuccessMessage(null);

    const { error } = await supabase.auth.resend({
      type: "signup",
      email: safeEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
          "/login?confirmed=1",
        )}`,
      },
    });

    setIsLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setCanResendConfirmation(false);
    setSuccessMessage("Confirmation email sent. Check your inbox.");
  }

  async function handleSaveNewPassword() {
    if (!supabase) {
      setSuccessMessage("Password updated.");
      return;
    }

    if (password.length < 8) {
      setMessage("Password must be at least 8 characters.");
      return;
    }

    setIsLoading(true);
    setMessage(null);
    setSuccessMessage(null);

    const { error } = await supabase.auth.updateUser({ password });

    setIsLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setPassword("");
    setIsPasswordRecovery(false);
    setAuthMode("login");
    setSuccessMessage("Password updated. You can now log in.");
    window.history.replaceState({}, "", "/login");
  }

  if (confirmationEmail) {
    return (
      <section className="mt-8">
        <div className="rounded-[26px] border border-[color:color-mix(in_srgb,var(--ve-green)_28%,var(--ve-line-soft))] bg-[color:color-mix(in_srgb,var(--ve-green-soft)_68%,var(--ve-card))] p-6 text-center shadow-[0_18px_40px_rgba(var(--ve-shadow-rgb),0.12)]">
          <div className="mx-auto grid size-16 place-items-center rounded-[22px] bg-[#008751] text-2xl font-black text-white">
            ✓
          </div>
          <h2 className="mt-5 text-2xl font-black leading-8 text-[var(--ve-ink)]">Check your email</h2>
          <p className="mt-3 text-sm font-semibold leading-6 text-[var(--ve-muted-strong)]">
            We sent a confirmation link to {confirmationEmail}. Confirm your account, then log in
            to continue.
          </p>
          <Button
            className="mt-6 w-full"
            onClick={() => {
              setAuthMode("login");
              setEmail(confirmationEmail);
              setPassword("");
              setConfirmationEmail(null);
              setMessage(null);
            }}
            type="button"
          >
            Back to Login
          </Button>
        </div>
      </section>
    );
  }

  if (emailConfirmed) {
    return (
      <section className="mt-8">
        <div className="rounded-[26px] border border-[color:color-mix(in_srgb,var(--ve-green)_28%,var(--ve-line-soft))] bg-[color:color-mix(in_srgb,var(--ve-green-soft)_68%,var(--ve-card))] p-6 text-center shadow-[0_18px_40px_rgba(var(--ve-shadow-rgb),0.12)]">
          <div className="mx-auto grid size-16 place-items-center rounded-[22px] bg-[#008751] text-2xl font-black text-white">
            ✓
          </div>
          <h2 className="mt-5 text-2xl font-black leading-8 text-[var(--ve-ink)]">Email confirmed</h2>
          <p className="mt-3 text-sm font-semibold leading-6 text-[var(--ve-muted-strong)]">
            Your account is ready. Log in to continue learning.
          </p>
          <Button
            className="mt-6 w-full"
            onClick={() => {
              setEmailConfirmed(false);
              setMessage(null);
            }}
            type="button"
          >
            Continue to Login
          </Button>
        </div>
      </section>
    );
  }

  return (
    <form className="mt-7 space-y-3" onSubmit={handleLogin}>
      {referralCode && authMode === "signup" ? (
        <p className="px-2 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
          <span className="font-black text-[var(--ve-green)]">Invite active.</span>{" "}
          Create an account to continue.
        </p>
      ) : null}

      {authMode === "signup" ? (
        <input
          className="h-11 w-full rounded-[30px] border border-[var(--ve-line)] px-7 text-[15px] font-semibold outline-none placeholder:text-[var(--ve-muted-soft)] focus:border-[#008751]"
          autoComplete="name"
          maxLength={120}
          onBlur={() => setFullName((current) => sanitizePlainTextInput(current, 120).trim())}
          onChange={(event) =>
            setFullName(sanitizePlainTextInput(event.target.value, 120))
          }
          placeholder="Enter Full Name"
          type="text"
          value={fullName}
        />
      ) : null}

      <input
        className="h-11 w-full rounded-[30px] border border-[var(--ve-line)] px-7 text-[15px] font-semibold outline-none placeholder:text-[var(--ve-muted-soft)] focus:border-[#008751]"
        autoComplete="email"
        maxLength={254}
        onBlur={() => setEmail((current) => normalizeEmailInput(current))}
        onChange={(event) => setEmail(event.target.value.replace(/[\u0000-\u001F\u007F<>]/g, ""))}
        placeholder="Enter Email Address"
        type="email"
        value={email}
      />
      <div className="relative">
        <input
          className="h-11 w-full rounded-[30px] border border-[var(--ve-line)] px-7 pr-20 text-[15px] font-semibold outline-none placeholder:text-[var(--ve-muted-soft)] focus:border-[#008751]"
          autoComplete={
            authMode === "signup" || isPasswordRecovery ? "new-password" : "current-password"
          }
          maxLength={128}
          minLength={authMode === "signup" || isPasswordRecovery ? 8 : undefined}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Enter Password"
          type={showPassword ? "text" : "password"}
          value={password}
        />
        <button
          className="absolute right-5 top-1/2 -translate-y-1/2 text-xs font-black text-[#008751]"
          onClick={() => setShowPassword((current) => !current)}
          type="button"
        >
          {showPassword ? "Hide" : "Show"}
        </button>
      </div>

      <div className="flex items-center justify-between px-2 text-[10px] font-semibold">
        <label className="flex items-center gap-2 text-[var(--ve-muted)]">
          <input
            checked={remember}
            className="size-3.5 accent-[#008751]"
            onChange={(event) => setRemember(event.target.checked)}
            type="checkbox"
          />
          Remember me
        </label>
        <button
          className="text-[#0824f8]"
          onClick={() => void handleForgotPassword()}
          type="button"
        >
          Forgot Password?
        </button>
      </div>

      {authMode === "signup" ? (
        <label className="flex items-start gap-3 rounded-[18px] bg-[var(--ve-panel-soft)] px-4 py-3 text-xs font-semibold leading-5 text-[var(--ve-muted-strong)]">
          <input
            checked={acceptedTerms}
            className="mt-0.5 size-4 shrink-0 accent-[#008751]"
            onChange={(event) => setAcceptedTerms(event.target.checked)}
            type="checkbox"
          />
          <span>
            I agree to the{" "}
            <Link className="font-black text-[#0824f8]" href="/terms">
              Terms
            </Link>
            {" "}and{" "}
            <Link className="font-black text-[#0824f8]" href="/privacy">
              Privacy Policy
            </Link>
            .
          </span>
        </label>
      ) : null}

      {turnstileSiteKey && authMode === "signup" ? (
        <div className="flex justify-center rounded-[18px] bg-[var(--ve-panel-soft)] px-3 py-3">
          <div id="project-ve-turnstile" />
        </div>
      ) : null}

      {message ? (
        <div className="rounded-[18px] bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">
          <p>{message}</p>
          {canResendConfirmation ? (
            <button
              className="mt-3 font-black text-[#008751]"
              disabled={isLoading}
              onClick={() => void handleResendConfirmation()}
              type="button"
            >
              Resend confirmation email
            </button>
          ) : null}
        </div>
      ) : null}

      {successMessage ? (
        <p className="rounded-[18px] bg-[#f4fbf7] px-4 py-3 text-xs font-bold text-[#008751]">
          {successMessage}
        </p>
      ) : null}

      {!isSupabaseConfigured ? (
        <p className="rounded-[18px] bg-[var(--ve-panel-soft)] px-4 py-3 text-xs leading-5 text-[var(--ve-muted)]">
          Supabase env vars are not set, so login continues in demo mode.
        </p>
      ) : null}

      <Button className="mt-6 w-full" disabled={isLoading} type="submit" variant="soft">
        {isPasswordRecovery
          ? isLoading
            ? "Saving password..."
            : "Save New Password"
          : isLoading
          ? authMode === "signup"
            ? "Creating account..."
            : "Logging in..."
          : authMode === "signup"
            ? "Create Account"
            : "Login"}
      </Button>

      <p className="pt-1 text-center text-sm font-bold text-[var(--ve-muted)]">
        {isPasswordRecovery
          ? "Remember your password?"
          : authMode === "signup"
            ? "Already have an account?"
            : "Don\u0027t have an account?"}{" "}
        <button
          className="text-[#0824f8]"
          onClick={() => {
            setAuthMode(isPasswordRecovery || authMode === "signup" ? "login" : "signup");
            setIsPasswordRecovery(false);
            setEmailConfirmed(false);
            setMessage(null);
            setSuccessMessage(null);
            setCanResendConfirmation(false);
            window.history.replaceState({}, "", "/login");
          }}
          type="button"
        >
          {isPasswordRecovery || authMode === "signup" ? "Login" : "Sign up"}
        </button>
      </p>

      {!isPasswordRecovery && isGoogleAuthEnabled ? (
        <>
          <div className="flex items-center gap-4 py-5">
            <span className="h-px flex-1 bg-[#d2d2d2]" />
            <span className="text-sm font-bold text-[var(--ve-muted-soft)]">or</span>
            <span className="h-px flex-1 bg-[#d2d2d2]" />
          </div>

          <Button
            className="w-full rounded-[10px]"
            onClick={handleGoogleLogin}
            type="button"
            variant="outline"
          >
            <span className="mr-3 text-lg font-black text-[#ea4335]">G</span>
            {authMode === "signup" ? "Sign up with Google" : "Sign in with Google"}
          </Button>
        </>
      ) : null}

      <div className="flex items-center justify-center gap-4 pt-4 text-xs font-bold text-[var(--ve-muted)]">
        <Link className="hover:text-[var(--foreground)]" href="/terms">
          Terms
        </Link>
        <span aria-hidden="true">•</span>
        <Link className="hover:text-[var(--foreground)]" href="/privacy">
          Privacy
        </Link>
        <span aria-hidden="true">•</span>
        <Link className="hover:text-[var(--foreground)]" href="/support">
          Support
        </Link>
      </div>
    </form>
  );
}
