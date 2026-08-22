import { redirect } from "next/navigation";
import { BottomNav } from "@/components/navigation/BottomNav";
import { LearnerTopChrome } from "@/components/navigation/LearnerTopChrome";
import { ProfileForm } from "@/components/profile/ProfileForm";
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
  const displayName =
    profile?.display_name && !profile.display_name.includes("@")
      ? profile.display_name
      : "Learner";

  return (
    <main className="learner-system profile-learner min-h-screen bg-[var(--ve-shell)]">
      <div className="hidden lg:block">
        <LearnerTopChrome
          active="Home"
          avatarUrl={profile?.avatar_url}
          displayName={displayName}
          email={user?.email}
          unreadNotificationCount={unreadNotificationCount}
        />
      </div>
      <ProfileForm
        avatarUrl={profile?.avatar_url ?? ""}
        displayName={profile?.display_name ?? ""}
        email={user?.email ?? ""}
        isDemoMode={isDemoMode}
        notificationPreferences={notificationPreferences}
      />
      <div className="lg:hidden">
        <BottomNav active="Home" />
      </div>
    </main>
  );
}
