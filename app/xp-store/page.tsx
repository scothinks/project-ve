import { redirect } from "next/navigation";
import { DirectAdCard } from "@/components/ads/DirectAdCard";
import { AppHeader } from "@/components/navigation/AppHeader";
import { BottomNav } from "@/components/navigation/BottomNav";
import { XPStore } from "@/components/rewards/XPStore";
import { getAdDecision, getLearnerAdSegments } from "@/lib/ads";
import { createSupabaseServerClient, getCurrentUserProfile } from "@/lib/supabase-server";
import { isSupabaseConfigured } from "@/lib/supabase";

export default async function XPStorePage() {
  const { user } = await getCurrentUserProfile();

  if (isSupabaseConfigured && !user) {
    redirect("/login");
  }
  const supabase = await createSupabaseServerClient();
  const segmentKeys = await getLearnerAdSegments(supabase, user?.id).catch(() => []);
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
      <XPStore />
      <section className="px-6 pb-28">
        <DirectAdCard ad={storeAd} />
      </section>
      <BottomNav active="Store" />
    </main>
  );
}
