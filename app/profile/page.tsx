import { redirect } from "next/navigation";
import { AppHeader } from "@/components/navigation/AppHeader";
import { BottomNav } from "@/components/navigation/BottomNav";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { isSupabaseConfigured } from "@/lib/supabase";
import { getCurrentUserProfile } from "@/lib/supabase-server";

export default async function ProfilePage() {
  const { user, profile } = await getCurrentUserProfile();

  if (isSupabaseConfigured && !user) {
    redirect("/login");
  }

  return (
    <main className="mobile-shell min-h-screen bg-[var(--ve-card)]">
      <AppHeader title="Profile" backHref="/dashboard" />
      <ProfileForm
        avatarUrl={profile?.avatar_url ?? ""}
        displayName={profile?.display_name ?? ""}
        email={user?.email ?? ""}
      />
      <BottomNav active="Home" />
    </main>
  );
}
