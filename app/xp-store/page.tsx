import { redirect } from "next/navigation";
import { AppHeader } from "@/components/navigation/AppHeader";
import { BottomNav } from "@/components/navigation/BottomNav";
import { XPStore } from "@/components/rewards/XPStore";
import { getCurrentUserProfile } from "@/lib/supabase-server";
import { isSupabaseConfigured } from "@/lib/supabase";

export default async function XPStorePage() {
  const { user } = await getCurrentUserProfile();

  if (isSupabaseConfigured && !user) {
    redirect("/login");
  }

  return (
    <main className="mobile-shell min-h-screen bg-[#fffaf0]">
      <AppHeader
        title="Store"
        backHref="/dashboard"
        className="bg-[#fffaf0] shadow-none"
        showMenu={false}
      />
      <XPStore />
      <BottomNav active="Store" />
    </main>
  );
}
