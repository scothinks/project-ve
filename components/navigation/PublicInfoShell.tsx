import type { ReactNode } from "react";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { AppHeader } from "@/components/navigation/AppHeader";
import { BottomNav } from "@/components/navigation/BottomNav";

async function hasAuthenticatedUser() {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return false;
  }

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    return Boolean(user);
  } catch {
    return false;
  }
}

export async function PublicInfoShell({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  const isAuthenticated = await hasAuthenticatedUser();

  return (
    <main className="mobile-shell min-h-screen bg-[var(--ve-shell)]">
      <AppHeader title={title} backHref={isAuthenticated ? "/profile" : "/"} showMenu={false} />
      <section className="learner-page learner-page--spacious space-y-5">
        {children}
      </section>
      {isAuthenticated ? <BottomNav active="Home" /> : null}
    </main>
  );
}
