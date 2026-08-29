import type { ReactNode } from "react";
import Link from "next/link";
import { getCurrentUserProfile } from "@/lib/supabase-server";
import { AppHeader } from "@/components/navigation/AppHeader";
import { BottomNav } from "@/components/navigation/BottomNav";
import { LearnerTopChrome } from "@/components/navigation/LearnerTopChrome";

export async function PublicInfoShell({
  children,
  title,
  wide = false,
}: {
  children: ReactNode;
  title: string;
  wide?: boolean;
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
      <AppHeader
        backHref={isAuthenticated ? "/profile" : "/"}
        hideTitle
        showMenu={false}
        title={title}
      />
      <section className="learner-page learner-page--spacious space-y-8">
        <div className={wide ? "space-y-5" : "learner-readable space-y-5"}>{children}</div>

        <footer className="flex flex-col items-center gap-3 border-t border-[var(--ve-line-soft)] pt-6 text-center lg:flex-row lg:justify-between lg:text-left">
          <p className="text-sm font-black">Project VE</p>
          <div className="flex items-center gap-4 text-xs font-bold text-[var(--ve-muted)]">
            <Link className="hover:text-[var(--foreground)]" href="/privacy">
              Privacy
            </Link>
            <span aria-hidden="true">•</span>
            <Link className="hover:text-[var(--foreground)]" href="/terms">
              Terms
            </Link>
            <span aria-hidden="true">•</span>
            <Link className="hover:text-[var(--foreground)]" href="/contact">
              Contact
            </Link>
          </div>
        </footer>
      </section>
      {isAuthenticated ? (
        <div className="learner-mobile-nav">
          <BottomNav active="Home" />
        </div>
      ) : null}
    </main>
  );
}
