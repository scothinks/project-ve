"use client";

import { FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/profile/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  ArrowLeftIcon,
  BellIcon,
  ChatIcon,
  ChevronRightIcon,
  EyeIcon,
  EyeOffIcon,
  GavelIcon,
  GraduationCapIcon,
  InfoIcon,
  LockIcon,
  LogoutIcon,
  ShieldIcon,
} from "@/components/ui/Icons";
import { sanitizePlainTextInput, sanitizeUrlInput } from "@/lib/input-safety";
import type { NotificationPreferences } from "@/lib/notifications";
import {
  getCurrentPushSubscription,
  isPushSupported,
  subscribeCurrentDevice,
  unsubscribeCurrentDevice,
} from "@/lib/push-client";
import { createSupabaseBrowserClient } from "@/lib/supabase";

type ProfileFormProps = {
  displayName: string;
  avatarUrl: string;
  email: string;
  isDemoMode: boolean;
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
  description,
  disabled = false,
  label,
  onToggle,
}: {
  checked: boolean;
  description: string;
  disabled?: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      className="flex w-full items-center justify-between gap-4 py-3 text-left disabled:cursor-not-allowed disabled:opacity-60 lg:py-3.5"
      disabled={disabled}
      onClick={onToggle}
      type="button"
    >
      <span>
        <span className="block text-sm font-black text-[var(--foreground)] lg:text-[0.95rem]">{label}</span>
        <span className="mt-0.5 block text-xs font-semibold leading-5 text-[var(--ve-muted-strong)]">
          {description}
        </span>
      </span>
      <span
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${
          checked ? "bg-[var(--ve-green)]" : "bg-[var(--ve-line)]"
        }`}
      >
        <span
          className={`absolute top-1 size-5 rounded-full bg-[var(--ve-card)] transition ${
            checked ? "left-6" : "left-1"
          }`}
        />
      </span>
    </button>
  );
}

function ProfileTabs({
  activeSection,
  setActiveSection,
}: {
  activeSection: ProfileSection;
  setActiveSection: (section: ProfileSection) => void;
}) {
  return (
    <div className="grid grid-cols-3 border-b border-[var(--ve-line-soft)] text-[11px] font-black lg:block lg:border-b-0 lg:text-sm">
      {[
        { id: "account", label: "Account" },
        { id: "notifications", label: "Notifications" },
        { id: "help", label: "Help & Legal" },
      ].map((section) => {
        const isActive = activeSection === section.id;

        return (
          <button
            className={`border-b-2 px-0 pb-3 pt-1 text-left transition lg:flex lg:w-full lg:items-center lg:justify-between lg:rounded-[8px] lg:border-b-0 lg:border-l-4 lg:px-4 lg:py-3 ${
              isActive
                ? "border-[var(--ve-green)] text-[var(--ve-green)] lg:bg-[var(--ve-green-soft)]"
                : "border-transparent text-[var(--ve-muted-strong)] lg:hover:bg-[var(--ve-card-muted)]"
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
  );
}

function ShortcutRow({
  description,
  icon,
  iconTone = "gold",
  label,
  onClick,
}: {
  description: string;
  icon: ReactNode;
  iconTone?: "gold" | "green";
  label: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span
        className={`grid size-10 shrink-0 place-items-center rounded-full ${
          iconTone === "green"
            ? "bg-[var(--ve-green-soft)] text-[var(--ve-green)]"
            : "bg-[var(--ve-store-soft)] text-[#a66d00]"
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-black text-[var(--foreground)]">{label}</span>
        <span className="mt-0.5 block text-[11px] font-semibold leading-4 text-[var(--ve-muted-strong)]">
          {description}
        </span>
      </span>
      <ChevronRightIcon className="h-5 w-5 shrink-0 text-[var(--ve-muted-strong)]" />
    </>
  );

  if (onClick) {
    return (
      <button
        className="flex w-full items-center gap-3 rounded-[14px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] px-3 py-3 text-left shadow-[0_8px_20px_rgba(var(--ve-shadow-rgb),0.04)] lg:rounded-[8px] lg:bg-[var(--ve-card-subtle)] lg:px-4 lg:py-4"
        onClick={onClick}
        type="button"
      >
        {content}
      </button>
    );
  }

  return (
    <Link
      className="flex items-center gap-3 rounded-[14px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] px-3 py-3 shadow-[0_8px_20px_rgba(var(--ve-shadow-rgb),0.04)] lg:rounded-[8px] lg:bg-[var(--ve-card-subtle)] lg:px-4 lg:py-4"
      href="/profile/transcript"
    >
      {content}
    </Link>
  );
}

function HelpLink({
  compact = false,
  href,
  icon,
  label,
}: {
  compact?: boolean;
  href: string;
  icon: ReactNode;
  label: string;
}) {
  return (
    <Link
      className={`group relative flex items-center justify-between overflow-hidden rounded-[8px] border border-[var(--ve-line-soft)] bg-[var(--ve-card-muted)] text-[var(--foreground)] shadow-[0_12px_30px_rgba(var(--ve-shadow-rgb),0.04)] ${
        compact ? "px-4 py-4" : "min-h-[112px] px-4 py-5 lg:min-h-[9rem] lg:p-6"
      }`}
      href={href}
    >
      <span className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--ve-green-soft)] text-[var(--ve-green)]">
          {icon}
        </span>
        <span className={compact ? "text-sm font-semibold" : "text-xl font-semibold"}>{label}</span>
      </span>
      <ChevronRightIcon className="h-5 w-5 shrink-0 text-[var(--ve-muted-soft)]" />
      {!compact ? (
        <span className="pointer-events-none absolute -right-10 -top-16 size-32 rounded-full bg-[color:color-mix(in_srgb,var(--ve-green-soft)_72%,transparent)]" />
      ) : null}
    </Link>
  );
}

export function ProfileForm({
  displayName,
  avatarUrl,
  email,
  isDemoMode,
  notificationPreferences: initialNotificationPreferences,
}: ProfileFormProps) {
  const router = useRouter();
  const browserSupabase = useMemo(() => createSupabaseBrowserClient(), []);
  const supabase = isDemoMode ? null : browserSupabase;
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
      if (!isDemoMode) {
        setError("Profile updates are unavailable until the live backend is configured.");
        return;
      }

      setName(safeName);
      setAvatar(safeAvatar);
      setMessage("Profile updated.");
      return;
    }

    setSavingProfile(true);

    const { error: updateError } = await supabase.rpc("update_my_profile", {
      p_display_name: safeName,
      p_avatar_url: safeAvatar || undefined,
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
      if (!isDemoMode) {
        setError("Password updates are unavailable until the live backend is configured.");
        return;
      }

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
      if (!isDemoMode) {
        setError("Sign out is unavailable until the live backend is configured.");
        return;
      }

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
      if (!isDemoMode) {
        setError("Notification preferences are unavailable until the live backend is configured.");
        setSavingPreferenceKey(null);
        return;
      }

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

  const pushStateLabel =
    pushPermission === "unsupported" || !vapidPublicKey
      ? "Unavailable"
      : pushPermission === "denied" && !pushEnabled
        ? "Blocked"
        : pushEnabled
          ? "On"
          : "Off";
  const profileName = name || "Your profile";

  return (
    <section className="mx-auto w-full max-w-[430px] px-5 pb-28 pt-8 lg:grid lg:max-w-[1116px] lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-8 lg:px-0 lg:pb-16 lg:pt-12">
      <aside className="space-y-4 lg:rounded-[12px] lg:border lg:border-[var(--ve-line-soft)] lg:bg-[var(--ve-card-subtle)] lg:p-5 lg:shadow-[0_18px_44px_rgba(var(--ve-shadow-rgb),0.08)]">
        <div className="flex items-center gap-3">
          {activeSection === "help" ? (
            <button
              aria-label="Back to account profile"
              className="grid size-7 place-items-center text-[var(--foreground)] lg:hidden"
              onClick={() => setActiveSection("account")}
              type="button"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
          ) : null}
          <h1 className="text-2xl font-black leading-8 text-[var(--foreground)] lg:text-[2rem] lg:leading-10">
            Profile
          </h1>
        </div>
        <div className="hidden border-y border-[var(--ve-line-soft)] py-5 lg:block">
          <Avatar avatarUrl={avatar} className="size-16 text-xl" email={email} name={profileName} />
          <p className="mt-3 text-lg font-black text-[var(--foreground)]">{profileName}</p>
          <p className="mt-1 break-all text-xs font-semibold leading-5 text-[var(--ve-muted-strong)]">
            {email}
          </p>
        </div>
        <ProfileTabs activeSection={activeSection} setActiveSection={setActiveSection} />
      </aside>

      {activeSection === "account" ? (
        <div className="mt-6 space-y-7 lg:mt-0 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-6 lg:space-y-0">
          <div className="text-center lg:hidden">
            <Avatar
              avatarUrl={avatar}
              className="mx-auto size-20 text-2xl"
              email={email}
              name={profileName}
            />
            <h2 className="mt-4 text-xl font-semibold leading-7 text-[var(--foreground)]">
              {profileName}
            </h2>
            <p className="text-xs font-medium text-[var(--ve-muted-strong)]">{email}</p>
          </div>

          <div className="space-y-5 lg:min-w-0">
            <form
              className="space-y-4 lg:rounded-[12px] lg:border lg:border-[var(--ve-line-soft)] lg:bg-[var(--ve-card-subtle)] lg:p-6 lg:shadow-[0_18px_44px_rgba(var(--ve-shadow-rgb),0.08)]"
              onSubmit={(event) => void saveProfile(event)}
            >
              <div className="hidden lg:block">
                <h2 className="text-xl font-black text-[var(--foreground)]">Account Details</h2>
                <p className="mt-1 text-sm font-semibold leading-6 text-[var(--ve-muted-strong)]">
                  Keep your learner profile current.
                </p>
              </div>
              <label className="block">
                <span className="text-xs font-medium text-[var(--ve-muted-strong)]">Display Name</span>
                <input
                  className="mt-2 h-12 w-full rounded-[8px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-4 text-sm font-medium outline-none focus:border-[var(--ve-green)] lg:bg-[var(--ve-shell)]"
                  maxLength={120}
                  onBlur={() => setName((current) => sanitizePlainTextInput(current, 120).trim())}
                  onChange={(event) => setName(sanitizePlainTextInput(event.target.value, 120))}
                  placeholder="Enter display name"
                  value={name}
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium text-[var(--ve-muted-strong)]">
                  Email Address (Read-only)
                </span>
                <span className="relative mt-2 block">
                  <input
                    className="h-12 w-full rounded-[8px] border border-[var(--ve-line-soft)] bg-[var(--ve-card-muted)] px-4 pr-11 text-sm font-medium text-[var(--ve-muted)] outline-none"
                    readOnly
                    value={email}
                  />
                  <LockIcon className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ve-muted)]" />
                </span>
              </label>

              <label className="block">
                <span className="text-xs font-medium text-[var(--ve-muted-strong)]">Avatar URL</span>
                <input
                  className="mt-2 h-12 w-full rounded-[8px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-4 text-sm font-medium outline-none focus:border-[var(--ve-green)] lg:bg-[var(--ve-shell)]"
                  maxLength={1000}
                  onBlur={() => setAvatar((current) => sanitizeUrlInput(current))}
                  onChange={(event) => setAvatar(event.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                  value={avatar}
                />
              </label>

              <Button className="h-12 w-full rounded-[8px] text-sm !text-white" disabled={savingProfile} type="submit">
                {savingProfile ? "Saving..." : "Save Profile"}
              </Button>
            </form>

            <div className="border-t border-[var(--ve-line-soft)] pt-6 lg:rounded-[12px] lg:border lg:border-[var(--ve-line-soft)] lg:bg-[var(--ve-card-subtle)] lg:p-6 lg:shadow-[0_18px_44px_rgba(var(--ve-shadow-rgb),0.08)]">
              <h2 className="text-xl font-semibold text-[var(--foreground)]">Account Security</h2>
              <label className="mt-4 block">
                <span className="text-xs font-medium text-[var(--ve-muted-strong)]">New Password</span>
                <span className="relative mt-2 block">
                  <input
                    className="h-12 w-full rounded-[8px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-4 pr-20 text-sm font-medium outline-none focus:border-[var(--ve-green)] lg:bg-[var(--ve-shell)]"
                    autoComplete="new-password"
                    maxLength={128}
                    minLength={8}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder="Enter new password"
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                  />
                  <button
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--ve-muted-strong)]"
                    onClick={() => setShowPassword((current) => !current)}
                    type="button"
                  >
                    {showPassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                  </button>
                </span>
              </label>
              <Button
                className="mt-3 h-12 w-full rounded-[8px] bg-[var(--ve-line-soft)] text-sm text-[var(--ve-muted-strong)]"
                disabled={savingPassword || newPassword.length < 8}
                onClick={() => void updatePassword()}
                type="button"
                variant="outline"
              >
                {savingPassword ? "Updating..." : "Update Password"}
              </Button>
            </div>
          </div>

          <div className="space-y-3 lg:rounded-[12px] lg:border lg:border-[var(--ve-line-soft)] lg:bg-[color:color-mix(in_srgb,var(--ve-store-soft)_42%,var(--ve-card-subtle))] lg:p-5 lg:shadow-[0_18px_44px_rgba(var(--ve-shadow-rgb),0.08)]">
            <div className="hidden lg:block">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#8a6a16]">
                Your Learning
              </p>
              <h2 className="mt-1 text-lg font-black text-[var(--foreground)]">Related links</h2>
            </div>
            <ShortcutRow
              description="View your learning record"
              icon={<GraduationCapIcon className="h-5 w-5" />}
              label="Learning Transcript"
            />
            <ShortcutRow
              description="Manage alerts and notifications"
              icon={<BellIcon className="h-5 w-5" />}
              iconTone="green"
              label="Notification Preferences"
              onClick={() => setActiveSection("notifications")}
            />
            <Button
              className="h-11 w-full gap-2 rounded-[8px] border-[#ef5b5b] text-[#d84242]"
              disabled={signingOut}
              onClick={() => void logout()}
              type="button"
              variant="outline"
            >
              <LogoutIcon className="h-4 w-4" />
              {signingOut ? "Logging out..." : "Logout"}
            </Button>
          </div>
        </div>
      ) : null}

      {activeSection === "notifications" ? (
        <div className="mt-6 space-y-5 lg:mt-0 lg:rounded-[12px] lg:border lg:border-[var(--ve-line-soft)] lg:bg-[var(--ve-card-subtle)] lg:p-6 lg:shadow-[0_18px_44px_rgba(var(--ve-shadow-rgb),0.08)]">
          <div>
            <h2 className="text-xl font-semibold text-[var(--foreground)] lg:text-2xl lg:font-black">
              Notification Preferences
            </h2>
            <p className="mt-1 text-sm font-semibold leading-5 text-[var(--ve-muted-strong)]">
              Manage how and when Project Ve communicates with you.
            </p>
          </div>

          <Card className="rounded-[14px] border-[var(--ve-line-soft)] bg-[var(--ve-card-muted)] px-4 py-3 shadow-none lg:rounded-[8px] lg:bg-[var(--ve-shell)] lg:px-5">
            <ToggleRow
              checked={preferences.inAppEnabled}
              description="Allow alerts within the app"
              disabled={savingPreferenceKey === "inAppEnabled"}
              label="In-app notifications"
              onToggle={() =>
                void updateNotificationPreference("inAppEnabled", !preferences.inAppEnabled)
              }
            />
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
          <Card className="rounded-[14px] border-[var(--ve-line-soft)] bg-[var(--ve-card-muted)] p-4 shadow-none lg:rounded-[8px] lg:bg-[var(--ve-shell)] lg:p-5">
            <p className="mb-3 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--ve-muted-strong)]">
              Activity Updates
            </p>
            <div className="divide-y divide-[var(--ve-line-soft)]">
              <ToggleRow
                checked={preferences.rewardsEnabled}
                description="Reward availability, redemption and fulfillment updates."
                disabled={!preferences.inAppEnabled || savingPreferenceKey === "rewardsEnabled"}
                label="Reward updates"
                onToggle={() =>
                  void updateNotificationPreference("rewardsEnabled", !preferences.rewardsEnabled)
                }
              />
              <ToggleRow
                checked={preferences.missionsEnabled}
                description="Mission progress, proof review and Mission status updates."
                disabled={!preferences.inAppEnabled || savingPreferenceKey === "missionsEnabled"}
                label="Mission reviews"
                onToggle={() =>
                  void updateNotificationPreference("missionsEnabled", !preferences.missionsEnabled)
                }
              />
            </div>
          </Card>

          <Card className="rounded-[14px] border-[var(--ve-line-soft)] bg-[var(--ve-card-muted)] p-4 shadow-none lg:rounded-[8px] lg:bg-[var(--ve-shell)] lg:p-5">
            <p className="mb-3 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--ve-muted-strong)]">
              System & Security
            </p>
            <div className="divide-y divide-[var(--ve-line-soft)]">
              <ToggleRow
                checked={preferences.accountEnabled}
                description="Login activity and password changes"
                disabled={!preferences.inAppEnabled || savingPreferenceKey === "accountEnabled"}
                label="Account alerts"
                onToggle={() =>
                  void updateNotificationPreference("accountEnabled", !preferences.accountEnabled)
                }
              />
              <ToggleRow
                checked={preferences.systemEnabled}
                description="Maintenance and app updates"
                disabled={!preferences.inAppEnabled || savingPreferenceKey === "systemEnabled"}
                label="System alerts"
                onToggle={() =>
                  void updateNotificationPreference("systemEnabled", !preferences.systemEnabled)
                }
              />
            </div>
          </Card>
          </div>

          <Card className="rounded-[14px] border-[var(--ve-line-soft)] bg-[var(--ve-card-muted)] p-4 shadow-none lg:rounded-[8px] lg:bg-[var(--ve-shell)] lg:p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--ve-card)] text-[var(--ve-muted-strong)]">
                  <BellIcon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-black text-[var(--foreground)]">Push alerts</p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-[var(--ve-muted-strong)]">
                    Browser push notifications are managed at the system level.
                  </p>
                </div>
              </div>
              <Button
                className="h-9 shrink-0 rounded-[8px] px-3 text-[11px]"
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
                {managingPush ? "Saving" : pushStateLabel}
              </Button>
            </div>
          </Card>
        </div>
      ) : null}

      {activeSection === "help" ? (
        <div className="mt-6 space-y-3 lg:mt-0 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
          <HelpLink href="/contact" icon={<InfoIcon className="h-5 w-5" />} label="Contact" />
          <HelpLink href="/faq" icon={<ChatIcon className="h-5 w-5" />} label="FAQ" />
          <HelpLink compact href="/terms" icon={<GavelIcon className="h-5 w-5" />} label="Terms of Service" />
          <HelpLink compact href="/privacy" icon={<ShieldIcon className="h-5 w-5" />} label="Privacy Policy" />
        </div>
      ) : null}

      {message ? (
        <p className="mt-5 rounded-[14px] bg-[color:color-mix(in_srgb,var(--ve-green-soft)_88%,var(--ve-card))] px-4 py-3 text-xs font-bold text-[var(--ve-green)] lg:col-start-2">
          {message}
        </p>
      ) : null}

      {error ? (
        <p className="mt-5 rounded-[14px] bg-[color:color-mix(in_srgb,#b63a3a_16%,var(--ve-card))] px-4 py-3 text-xs font-bold text-[#b63a3a] lg:col-start-2">
          {error}
        </p>
      ) : null}

      {isDemoMode && !supabase ? (
        <p className="mt-5 rounded-[14px] bg-[var(--ve-card-muted)] px-4 py-3 text-xs leading-5 text-[var(--ve-muted)] lg:col-start-2">
          Demo mode is active, so profile changes stay in this browser session.
        </p>
      ) : null}
    </section>
  );
}
