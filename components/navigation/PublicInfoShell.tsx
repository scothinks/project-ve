import type { ReactNode } from "react";
import { getCurrentUserProfile } from "@/lib/supabase-server";
import { AppHeader } from "@/components/navigation/AppHeader";
import { BottomNav } from "@/components/navigation/BottomNav";
import { LearnerTopChrome } from "@/components/navigation/LearnerTopChrome";

export async function PublicInfoShell({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  const { user, profile } = await getCurrentUserProfile();
  const rawDisplayName = profile?.display_name ?? "";
  const displayName = rawDisplayName && !rawDisplayName.includes("@") ? rawDisplayName : "Learner";
  const isAuthenticated = Boolean(user);

  return (
    <main className="mobile-shell min-h-screen bg-[var(--ve-shell)]">
      <div className="hidden lg:block">
        <LearnerTopChrome
          active="Home"
          avatarUrl={profile?.avatar_url}
          displayName={displayName}
          email={user?.email}
        />
      </div>
      <AppHeader title={title} backHref={isAuthenticated ? "/profile" : "/"} showMenu={false} />
      <section className="learner-page learner-page--spacious space-y-5">
        {children}
      </section>
      {isAuthenticated ? <BottomNav active="Home" /> : null}
    </main>
  );
}
