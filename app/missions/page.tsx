import { DirectAdCard } from "@/components/ads/DirectAdCard";
import { MissionPanel } from "@/components/missions/MissionPanel";
import { BottomNav } from "@/components/navigation/BottomNav";
import { LearnerTopChrome } from "@/components/navigation/LearnerTopChrome";
import { withLoggedFallback } from "@/lib/app-errors";
import { getAdDecision, getLearnerAdSegments } from "@/lib/ads";
import { getUnreadNotificationCount } from "@/lib/notifications";
import { createSupabaseServerClient, getCurrentUserProfile } from "@/lib/supabase-server";

export default async function MissionsPage() {
  const supabase = await createSupabaseServerClient();
  const { user, profile } = await getCurrentUserProfile(supabase);
  const rawDisplayName = profile?.display_name ?? "";
  const displayName = rawDisplayName && !rawDisplayName.includes("@") ? rawDisplayName : "Learner";
  const segmentKeys = await withLoggedFallback({
    context: {
      operation: "missions.ads.segments",
      userId: user?.id,
    },
    fallback: [],
    promise: getLearnerAdSegments(supabase, user?.id),
  });
  const missionsAd = await getAdDecision(supabase, {
    placementKey: "missions_card",
    route: "/missions",
    userId: user?.id,
    segmentKeys,
  });
  const unreadNotificationCount =
    user && supabase
      ? await withLoggedFallback({
          context: {
            operation: "missions.notifications.unread_count",
            userId: user.id,
          },
          fallback: 0,
          promise: getUnreadNotificationCount(supabase, user.id),
        })
      : 0;

  return (
    <main className="learner-system missions-learner min-h-screen">
      <LearnerTopChrome
        active="Missions"
        avatarUrl={profile?.avatar_url}
        displayName={displayName}
        email={user?.email}
        unreadNotificationCount={unreadNotificationCount}
      />
      <section className="learner-page learner-page--standard">
        <div className="mb-5">
          <h1 className="text-[1.55rem] font-black tracking-[-0.02em] text-[var(--foreground)]">
            Missions
          </h1>
          <p className="mt-1 max-w-[30rem] text-[0.82rem] font-medium leading-5 text-[var(--ve-muted)]">
            Complete tasks to earn XP and rewards.
          </p>
        </div>
        <MissionPanel />
        <div className="mt-6">
          <DirectAdCard ad={missionsAd} />
        </div>
      </section>
      <div className="learner-mobile-nav">
        <BottomNav active="Missions" />
      </div>
    </main>
  );
}
