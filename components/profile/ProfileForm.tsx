"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/profile/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { sanitizePlainTextInput, sanitizeUrlInput } from "@/lib/input-safety";
import type { NotificationPreferences } from "@/lib/notifications";
import {
  getCurrentPushSubscription,
  isPushSupported,
  subscribeCurrentDevice,
  unsubscribeCurrentDevice,
} from "@/lib/push-client";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";

type ProfileFormProps = {
  displayName: string;
  avatarUrl: string;
  email: string;
  notificationPreferences: NotificationPreferences;
};

type PreferenceKey =
  | "inAppEnabled"
  | "rewardsEnabled"
  | "missionsEnabled"
  | "accountEnabled"
  | "systemEnabled";

type ProfileSection = "account" | "notifications" | "help";

function ToggleRow({
  checked,
  disabled = false,
  label,
  onToggle,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      className="flex w-full items-center justify-between gap-4 py-3 text-left disabled:cursor-not-allowed disabled:opacity-60"
      disabled={disabled}
      onClick={onToggle}
      type="button"
    >
      <span className="text-sm font-black text-[var(--foreground)]">{label}</span>
      <span
        className={`relative h-7 w-12 rounded-full transition ${
          checked ? "bg-[#008751]" : "bg-[var(--ve-line)]"
        }`}
      >
        <span
          className={`absolute top-1 size-5 rounded-full bg-white transition ${
            checked ? "left-6" : "left-1"
          }`}
        />
      </span>
    </button>
  );
}

export function ProfileForm({
  displayName,
  avatarUrl,
  email,
  notificationPreferences: initialNotificationPreferences,
}: ProfileFormProps) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
  const [pushEnabled, setPushEnabled] = useState(initialNotificationPreferences.webPushEnabled);
  const [name, setName] = useState(displayName);
  const [avatar, setAvatar] = useState(avatarUrl);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [activeSection, setActiveSection] = useState<ProfileSection>("account");
  const [preferences, setPreferences] = useState(initialNotificationPreferences);
  const [pushPermission, setPushPermission] = useState<NotificationPermission | "unsupported">(
    "unsupported",
  );
  const [managingPush, setManagingPush] = useState(false);
  const [savingPreferenceKey, setSavingPreferenceKey] = useState<PreferenceKey | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!isPushSupported()) {
      setPushPermission("unsupported");
      return;
    }

    setPushPermission(Notification.permission);

    void getCurrentPushSubscription()
      .then((subscription) => {
        setPushEnabled(Boolean(subscription));
      })
      .catch(() => undefined);
  }, []);

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

  async function enablePushNotifications() {
    setMessage(null);
    setError(null);

    if (!vapidPublicKey) {
      setError("Push notifications are not configured yet.");
      return;
    }

    if (!isPushSupported()) {
      setError("Push notifications are not supported on this device.");
      return;
    }

    setManagingPush(true);

    try {
      const { permission } = await subscribeCurrentDevice(vapidPublicKey);
      setPushPermission(permission);
      setPushEnabled(true);
      setMessage("Push alerts enabled on this device.");
    } catch (pushError) {
      setError(pushError instanceof Error ? pushError.message : "Could not enable push alerts.");
      if (isPushSupported()) {
        setPushPermission(Notification.permission);
      }
    } finally {
      setManagingPush(false);
    }
  }

  async function disablePushNotifications() {
    setMessage(null);
    setError(null);
    setManagingPush(true);

    try {
      await unsubscribeCurrentDevice();
      setPushEnabled(false);
      setMessage("Push alerts disabled on this device.");
    } catch (pushError) {
      setError(pushError instanceof Error ? pushError.message : "Could not disable push alerts.");
    } finally {
      setManagingPush(false);
    }
  }

  async function updateNotificationPreference(key: PreferenceKey, value: boolean) {
    setMessage(null);
    setError(null);
    setSavingPreferenceKey(key);

    if (!supabase) {
      setPreferences((current) => ({ ...current, [key]: value }));
      setSavingPreferenceKey(null);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSavingPreferenceKey(null);
      setError("Sign in again to update notification settings.");
      return;
    }

    const nextPreferences = {
      ...preferences,
      [key]: value,
    };

    const { error: preferenceError } = await supabase
      .from("notification_preferences")
      .update({
        in_app_enabled: nextPreferences.inAppEnabled,
        rewards_enabled: nextPreferences.rewardsEnabled,
        missions_enabled: nextPreferences.missionsEnabled,
        account_enabled: nextPreferences.accountEnabled,
        system_enabled: nextPreferences.systemEnabled,
      })
      .eq("user_id", user.id);

    setSavingPreferenceKey(null);

    if (preferenceError) {
      setError(preferenceError.message);
      return;
    }

    setPreferences(nextPreferences);
  }

  return (
    <section className="space-y-5 px-6 py-8 pb-28">
      <div>
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

      <div className="grid grid-cols-3 rounded-[24px] bg-[var(--ve-panel-soft)] p-1.5">
        {[
          { id: "account", label: "Account" },
          { id: "notifications", label: "Notifications" },
          { id: "help", label: "Help & Legal" },
        ].map((section) => {
          const isActive = activeSection === section.id;
          return (
            <button
              className={`rounded-[18px] px-3 py-3 text-center text-[11px] font-black tracking-[-0.01em] transition ${
                isActive
                  ? "bg-white text-[var(--foreground)] shadow-[0_10px_24px_rgba(var(--ve-shadow-rgb),0.12)]"
                  : "text-[var(--ve-muted)]"
              }`}
              key={section.id}
              onClick={() => setActiveSection(section.id as ProfileSection)}
              type="button"
            >
              {section.label}
            </button>
          );
        })}
      </div>

      {activeSection === "account" ? (
        <>
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
            <h2 className="text-base font-black">Password</h2>
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

          <Button
            className="w-full"
            disabled={signingOut}
            onClick={() => void logout()}
            type="button"
            variant="outline"
          >
            {signingOut ? "Logging out..." : "Log out"}
          </Button>
        </>
      ) : null}

      {activeSection === "notifications" ? (
        <Card className="p-5">
          <div className="divide-y divide-[var(--ve-line-soft)]">
            <ToggleRow
              checked={preferences.inAppEnabled}
              disabled={savingPreferenceKey === "inAppEnabled"}
              label="In-app"
              onToggle={() =>
                void updateNotificationPreference("inAppEnabled", !preferences.inAppEnabled)
              }
            />
            <ToggleRow
              checked={preferences.rewardsEnabled}
              disabled={!preferences.inAppEnabled || savingPreferenceKey === "rewardsEnabled"}
              label="Reward updates"
              onToggle={() =>
                void updateNotificationPreference("rewardsEnabled", !preferences.rewardsEnabled)
              }
            />
            <ToggleRow
              checked={preferences.missionsEnabled}
              disabled={!preferences.inAppEnabled || savingPreferenceKey === "missionsEnabled"}
              label="Mission reviews"
              onToggle={() =>
                void updateNotificationPreference("missionsEnabled", !preferences.missionsEnabled)
              }
            />
            <ToggleRow
              checked={preferences.accountEnabled}
              disabled={!preferences.inAppEnabled || savingPreferenceKey === "accountEnabled"}
              label="Account alerts"
              onToggle={() =>
                void updateNotificationPreference("accountEnabled", !preferences.accountEnabled)
              }
            />
            <ToggleRow
              checked={preferences.systemEnabled}
              disabled={!preferences.inAppEnabled || savingPreferenceKey === "systemEnabled"}
              label="System alerts"
              onToggle={() =>
                void updateNotificationPreference("systemEnabled", !preferences.systemEnabled)
              }
            />
          </div>

          <div className="mt-4 rounded-[20px] bg-[var(--ve-panel-soft)] px-4 py-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-black text-[var(--foreground)]">Push alerts</p>
                {pushPermission === "unsupported" ? (
                  <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">Unavailable</p>
                ) : pushPermission === "denied" && !preferences.webPushEnabled ? (
                  <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">Blocked in browser</p>
                ) : !vapidPublicKey ? (
                  <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">Unavailable</p>
                ) : null}
              </div>
              <Button
                className="h-10 px-4"
                disabled={
                  managingPush
                  || pushPermission === "unsupported"
                  || (!pushEnabled && (!vapidPublicKey || pushPermission === "denied"))
                }
                onClick={() =>
                  void (pushEnabled ? disablePushNotifications() : enablePushNotifications())
                }
                type="button"
                variant={pushEnabled ? "outline" : "soft"}
              >
                {managingPush
                  ? pushEnabled
                    ? "Turning off..."
                    : "Turning on..."
                  : pushEnabled
                    ? "On"
                    : "Off"}
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      {activeSection === "help" ? (
        <Card className="p-5">
          <div className="space-y-3">
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
      ) : null}

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
