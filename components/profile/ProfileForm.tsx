"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/profile/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { sanitizePlainTextInput, sanitizeUrlInput } from "@/lib/input-safety";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";

type ProfileFormProps = {
  displayName: string;
  avatarUrl: string;
  email: string;
};

export function ProfileForm({ displayName, avatarUrl, email }: ProfileFormProps) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [name, setName] = useState(displayName);
  const [avatar, setAvatar] = useState(avatarUrl);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    const safeName = sanitizePlainTextInput(name, 120).trim();
    const safeAvatar = sanitizeUrlInput(avatar);

    if (safeName.length < 2) {
      setError("Enter your name.");
      return;
    }

    if (avatar.trim() && !safeAvatar) {
      setError("Enter a valid avatar URL.");
      return;
    }

    if (!supabase) {
      setName(safeName);
      setAvatar(safeAvatar);
      setMessage("Profile updated.");
      return;
    }

    setSavingProfile(true);

    const { error: updateError } = await supabase.rpc("update_my_profile", {
      p_display_name: safeName,
      p_avatar_url: safeAvatar || null,
    });

    setSavingProfile(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setName(safeName);
    setAvatar(safeAvatar);
    setMessage("Profile updated.");
  }

  async function updatePassword() {
    setMessage(null);
    setError(null);

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (!supabase) {
      setNewPassword("");
      setMessage("Password updated.");
      return;
    }

    setSavingPassword(true);

    const { error: passwordError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    setSavingPassword(false);

    if (passwordError) {
      setError(passwordError.message);
      return;
    }

    setNewPassword("");
    setMessage("Password updated.");
  }

  async function logout() {
    setMessage(null);
    setError(null);

    if (!supabase) {
      router.replace("/login");
      return;
    }

    setSigningOut(true);

    const { error: signOutError } = await supabase.auth.signOut();

    setSigningOut(false);

    if (signOutError) {
      setError(signOutError.message);
      return;
    }

    router.replace("/login");
    router.refresh();
  }

  return (
    <section className="space-y-5 px-6 py-8 pb-28">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#008751]">
          Account
        </p>
        <h1 className="mt-2 text-2xl font-black leading-8">Manage profile</h1>
        <p className="mt-2 text-sm font-semibold leading-5 text-[var(--ve-muted)]">{email}</p>
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-4">
          <Avatar avatarUrl={avatar} className="size-20 shrink-0 text-2xl" email={email} name={name} />
          <div>
            <p className="text-sm font-black">{name || "Your profile"}</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
              Your avatar can be any public image URL.
            </p>
          </div>
        </div>
      </Card>

      <form className="space-y-3" onSubmit={(event) => void saveProfile(event)}>
        <label className="block">
          <span className="px-2 text-[11px] font-bold text-[var(--ve-muted)]">Account email</span>
          <input
            className="mt-1 h-11 w-full rounded-[30px] border border-[var(--ve-line)] bg-[var(--ve-panel-soft)] px-5 text-sm font-semibold text-[var(--ve-muted)] outline-none"
            readOnly
            value={email}
          />
        </label>

        <label className="block">
          <span className="px-2 text-[11px] font-bold text-[var(--ve-muted)]">Full name</span>
          <input
            className="mt-1 h-11 w-full rounded-[30px] border border-[var(--ve-line)] px-5 text-sm font-semibold outline-none focus:border-[#008751]"
            maxLength={120}
            onBlur={() => setName((current) => sanitizePlainTextInput(current, 120).trim())}
            onChange={(event) => setName(sanitizePlainTextInput(event.target.value, 120))}
            placeholder="Enter full name"
            value={name}
          />
        </label>

        <label className="block">
          <span className="px-2 text-[11px] font-bold text-[var(--ve-muted)]">Avatar URL</span>
          <input
            className="mt-1 h-11 w-full rounded-[30px] border border-[var(--ve-line)] px-5 text-sm font-semibold outline-none focus:border-[#008751]"
            maxLength={1000}
            onBlur={() => setAvatar((current) => sanitizeUrlInput(current))}
            onChange={(event) => setAvatar(event.target.value)}
            placeholder="https://..."
            value={avatar}
          />
        </label>

        <Button className="w-full" disabled={savingProfile} type="submit">
          {savingProfile ? "Saving..." : "Save Profile"}
        </Button>
      </form>

      <Card className="p-5">
        <h2 className="text-base font-black">Update password</h2>
        <div className="relative mt-4">
          <input
            className="h-11 w-full rounded-[30px] border border-[var(--ve-line)] px-5 pr-20 text-sm font-semibold outline-none focus:border-[#008751]"
            autoComplete="new-password"
            maxLength={128}
            minLength={8}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder="New password"
            type={showPassword ? "text" : "password"}
            value={newPassword}
          />
          <button
            className="absolute right-5 top-1/2 -translate-y-1/2 text-xs font-black text-[#008751]"
            onClick={() => setShowPassword((current) => !current)}
            type="button"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
        <Button
          className="mt-3 w-full"
          disabled={savingPassword}
          onClick={() => void updatePassword()}
          type="button"
          variant="soft"
        >
          {savingPassword ? "Updating..." : "Update Password"}
        </Button>
      </Card>

      <Card className="p-5">
        <h2 className="text-base font-black">Help and legal</h2>
        <div className="mt-4 space-y-3">
          <Link
            className="flex items-center justify-between rounded-[16px] border border-[var(--ve-line-soft)] px-4 py-4 text-sm font-black text-[var(--foreground)]"
            href="/support"
          >
            <span>Support</span>
            <span aria-hidden="true" className="text-[var(--ve-muted)]">
              &gt;
            </span>
          </Link>
          <Link
            className="flex items-center justify-between rounded-[16px] border border-[var(--ve-line-soft)] px-4 py-4 text-sm font-black text-[var(--foreground)]"
            href="/faq"
          >
            <span>FAQ</span>
            <span aria-hidden="true" className="text-[var(--ve-muted)]">
              &gt;
            </span>
          </Link>
          <Link
            className="flex items-center justify-between rounded-[16px] border border-[var(--ve-line-soft)] px-4 py-4 text-sm font-black text-[var(--foreground)]"
            href="/terms"
          >
            <span>Terms</span>
            <span aria-hidden="true" className="text-[var(--ve-muted)]">
              &gt;
            </span>
          </Link>
          <Link
            className="flex items-center justify-between rounded-[16px] border border-[var(--ve-line-soft)] px-4 py-4 text-sm font-black text-[var(--foreground)]"
            href="/privacy"
          >
            <span>Privacy</span>
            <span aria-hidden="true" className="text-[var(--ve-muted)]">
              &gt;
            </span>
          </Link>
        </div>
      </Card>

      <Button
        className="w-full"
        disabled={signingOut}
        onClick={() => void logout()}
        type="button"
        variant="outline"
      >
        {signingOut ? "Logging out..." : "Log out"}
      </Button>

      {message ? (
        <p className="rounded-[18px] bg-[#f4fbf7] px-4 py-3 text-xs font-bold text-[#008751]">
          {message}
        </p>
      ) : null}

      {error ? (
        <p className="rounded-[18px] bg-red-50 px-4 py-3 text-xs font-bold text-red-700">
          {error}
        </p>
      ) : null}

      {!isSupabaseConfigured ? (
        <p className="rounded-[18px] bg-[var(--ve-panel-soft)] px-4 py-3 text-xs leading-5 text-[var(--ve-muted)]">
          Supabase env vars are not set, so profile changes stay in demo mode.
        </p>
      ) : null}
    </section>
  );
}
