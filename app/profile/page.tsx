import { redirect } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/navigation/AppHeader";
import { BottomNav } from "@/components/navigation/BottomNav";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { BellIcon } from "@/components/ui/Icons";
import { getNotificationPreferences, getUnreadNotificationCount } from "@/lib/notifications";
import { isSupabaseConfigured } from "@/lib/supabase";
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

  if (isSupabaseConfigured && !user) {
    redirect("/login");
  }

  const supabase = await createSupabaseServerClient();
  const notificationPreferences =
    supabase && user
      ? await getNotificationPreferences(supabase, user.id).catch(() => defaultNotificationPreferences)
      : defaultNotificationPreferences;
  const unreadNotificationCount =
    supabase && user
      ? await getUnreadNotificationCount(supabase, user.id).catch(() => 0)
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
      <ProfileForm
        avatarUrl={profile?.avatar_url ?? ""}
        displayName={profile?.display_name ?? ""}
        email={user?.email ?? ""}
        notificationPreferences={notificationPreferences}
      />
      <BottomNav active="Home" />
    </main>
  );
}
