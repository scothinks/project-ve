import { redirect } from "next/navigation";
import { DirectAdCard } from "@/components/ads/DirectAdCard";
import { AppHeader } from "@/components/navigation/AppHeader";
import { BottomNav } from "@/components/navigation/BottomNav";
import { XPStore } from "@/components/rewards/XPStore";
import { withLoggedFallback } from "@/lib/app-errors";
import { getAdDecision, getLearnerAdSegments } from "@/lib/ads";
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
  const [segmentKeys, rewardSnapshot] = await Promise.all([
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
  ]);
  const storeAd = await getAdDecision(supabase, {
    placementKey: "xp_store_card",
    route: "/xp-store",
    userId: user?.id,
    segmentKeys,
  });

  return (
    <main className="mobile-shell min-h-screen bg-[#fffaf0]">
      <AppHeader
        title="Store"
        backHref="/dashboard"
        className="bg-[#fffaf0] shadow-none"
        showMenu={false}
      />
      <XPStore initialSnapshot={rewardSnapshot} />
      <section className="learner-page">
        <DirectAdCard ad={storeAd} />
      </section>
      <BottomNav active="Store" />
    </main>
  );
}
