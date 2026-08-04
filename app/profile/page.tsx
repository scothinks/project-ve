import { redirect } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/navigation/AppHeader";
import { BottomNav } from "@/components/navigation/BottomNav";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { Card } from "@/components/ui/Card";
import { BellIcon, ChevronRightIcon } from "@/components/ui/Icons";
import { withLoggedFallback } from "@/lib/app-errors";
import { isDemoMode, isLiveMode } from "@/lib/app-mode";
import { getNotificationPreferences, getUnreadNotificationCount } from "@/lib/notifications";
import { createSupabaseServerClient, getCurrentUserProfile } from "@/lib/supabase-server";

const defaultNotificationPreferences = {
  inAppEnabled: true,
  webPushEnabled: false,
  rewardsEnabled: true,
  missionsEnabled: true,
  accountEnabled: true,
  systemEnabled: true,
};

export default async function ProfilePage() {
  const { user, profile } = await getCurrentUserProfile();

  if (isLiveMode && !user) {
    redirect("/login");
  }

  const supabase = await createSupabaseServerClient();
  const notificationPreferences =
    supabase && user
      ? await withLoggedFallback({
          context: {
            operation: "profile.notification_preferences.load",
            userId: user.id,
          },
          fallback: defaultNotificationPreferences,
          promise: getNotificationPreferences(supabase, user.id),
        })
      : defaultNotificationPreferences;
  const unreadNotificationCount =
    supabase && user
      ? await withLoggedFallback({
          context: {
            operation: "profile.notifications.unread_count",
            userId: user.id,
          },
          fallback: 0,
          promise: getUnreadNotificationCount(supabase, user.id),
        })
      : 0;

  return (
    <main className="mobile-shell min-h-screen bg-[var(--ve-card)]">
      <AppHeader
        title="Profile"
        backHref="/dashboard"
        menu={(
          <Link
            aria-label={
              unreadNotificationCount > 0
                ? `Open notifications (${unreadNotificationCount} unread)`
                : "Open notifications"
            }
            className="relative grid size-10 place-items-center rounded-full bg-[var(--ve-panel-soft)] text-[var(--foreground)]"
            href="/notifications"
          >
            <BellIcon className="h-5 w-5" />
            {unreadNotificationCount > 0 ? (
              <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-[#ff7a59] px-1.5 py-0.5 text-center text-[10px] font-black leading-none text-white">
                {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
              </span>
            ) : null}
          </Link>
        )}
      />
      <section className="px-5 pb-2">
        <Link href="/profile/transcript">
          <Card className="rounded-[20px] p-4" variant="quiet">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">
                  Learning record
                </p>
                <h2 className="mt-1 text-base font-black text-[var(--foreground)]">Transcript</h2>
                <p className="mt-1 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
                  View course and programme completion status.
                </p>
              </div>
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--ve-panel-soft)] text-lg font-black text-[var(--ve-green)]">
                <ChevronRightIcon className="h-5 w-5" />
              </span>
            </div>
          </Card>
        </Link>
      </section>
      <ProfileForm
        avatarUrl={profile?.avatar_url ?? ""}
        displayName={profile?.display_name ?? ""}
        email={user?.email ?? ""}
        isDemoMode={isDemoMode}
        notificationPreferences={notificationPreferences}
      />
      <BottomNav active="Home" />
    </main>
  );
}
