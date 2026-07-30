import { DirectAdCard } from "@/components/ads/DirectAdCard";
import { MissionPanel } from "@/components/missions/MissionPanel";
import { AppHeader } from "@/components/navigation/AppHeader";
import { BottomNav } from "@/components/navigation/BottomNav";
import { ExperienceHeader } from "@/components/ui/ExperienceHeader";
import { withLoggedFallback } from "@/lib/app-errors";
import { getAdDecision, getLearnerAdSegments } from "@/lib/ads";
import { createSupabaseServerClient, getCurrentUserProfile } from "@/lib/supabase-server";

export default async function MissionsPage() {
  const supabase = await createSupabaseServerClient();
  const { user } = await getCurrentUserProfile(supabase);
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

  return (
    <main className="mobile-shell min-h-screen bg-[#fffaf4]">
      <AppHeader
        title="Missions"
        backHref="/dashboard"
        className="bg-[#fffaf4] shadow-none"
        showMenu={false}
      />
      <section className="learner-page learner-page--standard">
        <ExperienceHeader
          badge={
            <div className="grid size-16 place-items-center rounded-[22px] bg-[#ff7a59] text-sm font-black uppercase tracking-[0.08em] text-white shadow-[0_12px_24px_rgba(255,122,89,0.22)]">
              Wins
            </div>
          }
          eyebrow="XP And Rewards"
          metrics={[
            { label: "Act", value: "Go", valueClassName: "text-[#ff7a59]" },
            { label: "Prove", value: "Do", valueClassName: "text-[#087f5b]" },
            { label: "Earn", value: "Win", valueClassName: "text-[#c08a00]" },
          ]}
          subtitle="Quick challenges, community actions, and prize wins outside lessons."
          title="Welcome to Missions"
          tone="mission"
        />
        <div className="mt-6">
          <MissionPanel />
        </div>
        <div className="mt-6">
          <DirectAdCard ad={missionsAd} />
        </div>
      </section>
      <BottomNav active="Missions" />
    </main>
  );
}
