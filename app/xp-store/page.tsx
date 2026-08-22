import { redirect } from "next/navigation";
import { DirectAdCard } from "@/components/ads/DirectAdCard";
import { BottomNav } from "@/components/navigation/BottomNav";
import { LearnerTopChrome } from "@/components/navigation/LearnerTopChrome";
import { XPStore } from "@/components/rewards/XPStore";
import { withLoggedFallback } from "@/lib/app-errors";
import { getAdDecision, getLearnerAdSegments } from "@/lib/ads";
import { getUnreadNotificationCount } from "@/lib/notifications";
import { createSupabaseServerClient, getCurrentUserProfile } from "@/lib/supabase-server";
import { isDemoMode, isLiveMode } from "@/lib/app-mode";
import { createRewardRepository } from "@/features/app/repositories/rewards";

export default async function XPStorePage() {
  const supabase = await createSupabaseServerClient();
  const { user, profile } = await getCurrentUserProfile(supabase);
  const rewardRepository = createRewardRepository(supabase);

  if (isLiveMode && !user) {
    redirect("/login");
  }
  const rawDisplayName = profile?.display_name ?? "";
  const displayName = rawDisplayName && !rawDisplayName.includes("@") ? rawDisplayName : "Learner";
  const [segmentKeys, rewardSnapshot, unreadNotificationCount] = await Promise.all([
    withLoggedFallback({
      context: {
        operation: "xp_store.ads.segments",
        userId: user?.id,
      },
      fallback: [],
      promise: getLearnerAdSegments(supabase, user?.id),
    }),
    isLiveMode && user && profile
      ? withLoggedFallback({
          context: {
            operation: "xp_store.reward_store.load",
            userId: user.id,
          },
          fallback: null,
          promise: rewardRepository.getStoreSnapshot(user.id, profile.xp_balance_cached ?? 0),
        })
      : isDemoMode
        ? rewardRepository.getStoreSnapshot("demo-user", 0)
        : Promise.resolve(null),
    user && supabase
      ? withLoggedFallback({
          context: {
            operation: "xp_store.notifications.unread_count",
            userId: user.id,
          },
          fallback: 0,
          promise: getUnreadNotificationCount(supabase, user.id),
        })
      : Promise.resolve(0),
  ]);
  const storeAd = await getAdDecision(supabase, {
    placementKey: "xp_store_card",
    route: "/xp-store",
    userId: user?.id,
    segmentKeys,
  });

  return (
    <main className="learner-system store-learner min-h-screen">
      <LearnerTopChrome
        active="Store"
        avatarUrl={profile?.avatar_url}
        displayName={displayName}
        email={user?.email}
        unreadNotificationCount={unreadNotificationCount}
      />
      <XPStore initialSnapshot={rewardSnapshot} />
      <section className="learner-page">
        <DirectAdCard ad={storeAd} />
      </section>
      <div className="learner-mobile-nav">
        <BottomNav active="Store" />
      </div>
    </main>
  );
}
