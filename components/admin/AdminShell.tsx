"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/Icons";
import type { UserProfile } from "@/lib/supabase-server";
import { cn } from "@/lib/utils";

type IconProps = {
  className?: string;
};

function iconStroke(className?: string) {
  return cn("h-[18px] w-[18px] shrink-0 stroke-[2.2]", className);
}

function OverviewIcon({ className }: IconProps) {
  return (
    <svg className={iconStroke(className)} fill="none" viewBox="0 0 24 24">
      <path d="M4 5h7v6H4zM13 5h7v10h-7zM4 13h7v6H4zM13 17h7v2h-7z" stroke="currentColor" />
    </svg>
  );
}

function CoursesIcon({ className }: IconProps) {
  return (
    <svg className={iconStroke(className)} fill="none" viewBox="0 0 24 24">
      <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 0-3 0z" stroke="currentColor" />
      <path d="M5 4v16" stroke="currentColor" />
      <path d="M9 8h6M9 11h6" stroke="currentColor" />
    </svg>
  );
}

function RecommendationsIcon({ className }: IconProps) {
  return (
    <svg className={iconStroke(className)} fill="none" viewBox="0 0 24 24">
      <path d="m12 4 2.2 4.45 4.8.7-3.5 3.4.83 4.8L12 15.1 7.67 17.35l.83-4.8L5 9.15l4.8-.7z" stroke="currentColor" />
    </svg>
  );
}

function CampaignsIcon({ className }: IconProps) {
  return (
    <svg className={iconStroke(className)} fill="none" viewBox="0 0 24 24">
      <path d="M5 7h10l4 4-4 4H5z" stroke="currentColor" />
      <path d="M5 7v10" stroke="currentColor" />
    </svg>
  );
}

function RewardsIcon({ className }: IconProps) {
  return (
    <svg className={iconStroke(className)} fill="none" viewBox="0 0 24 24">
      <path d="M7 7h10v10H7z" stroke="currentColor" />
      <path d="M12 7v10M7 12h10" stroke="currentColor" />
      <path d="M8.5 7A1.5 1.5 0 1 1 10 5.5V7M15.5 7A1.5 1.5 0 1 0 14 5.5V7" stroke="currentColor" />
    </svg>
  );
}

function PerksIcon({ className }: IconProps) {
  return (
    <svg className={iconStroke(className)} fill="none" viewBox="0 0 24 24">
      <path d="M12 3 19 7v10l-7 4-7-4V7z" stroke="currentColor" />
      <path d="m9 12 2 2 4-4" stroke="currentColor" />
    </svg>
  );
}

function InventoryIcon({ className }: IconProps) {
  return (
    <svg className={iconStroke(className)} fill="none" viewBox="0 0 24 24">
      <path d="M4 8h16v11H4zM7 8V5h10v3" stroke="currentColor" />
      <path d="M10 13h4" stroke="currentColor" />
    </svg>
  );
}

function RedemptionsIcon({ className }: IconProps) {
  return (
    <svg className={iconStroke(className)} fill="none" viewBox="0 0 24 24">
      <path d="M6 6h12v12H6z" stroke="currentColor" />
      <path d="M9 10h6M9 14h4" stroke="currentColor" />
    </svg>
  );
}

function MissionsIcon({ className }: IconProps) {
  return (
    <svg className={iconStroke(className)} fill="none" viewBox="0 0 24 24">
      <path d="M12 4a8 8 0 1 0 8 8" stroke="currentColor" />
      <path d="m15 5 4 1-1 4" stroke="currentColor" />
      <path d="M12 12 19 6" stroke="currentColor" />
    </svg>
  );
}

function ContentIcon({ className }: IconProps) {
  return (
    <svg className={iconStroke(className)} fill="none" viewBox="0 0 24 24">
      <path d="M6 5h12v14H6z" stroke="currentColor" />
      <path d="M9 9h6M9 12h6M9 15h4" stroke="currentColor" />
    </svg>
  );
}

function ProofsIcon({ className }: IconProps) {
  return (
    <svg className={iconStroke(className)} fill="none" viewBox="0 0 24 24">
      <path d="M7 4h7l5 5v11H7z" stroke="currentColor" />
      <path d="M14 4v5h5M10 14l1.5 1.5L15 12" stroke="currentColor" />
    </svg>
  );
}

function UsersIcon({ className }: IconProps) {
  return (
    <svg className={iconStroke(className)} fill="none" viewBox="0 0 24 24">
      <path d="M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" />
      <path d="M5 19a7 7 0 0 1 14 0" stroke="currentColor" />
    </svg>
  );
}

function XpSettingsIcon({ className }: IconProps) {
  return (
    <svg className={iconStroke(className)} fill="none" viewBox="0 0 24 24">
      <path d="M12 8.5A3.5 3.5 0 1 0 12 15.5 3.5 3.5 0 0 0 12 8.5Z" stroke="currentColor" />
      <path d="M12 3v3M12 18v3M21 12h-3M6 12H3M18.36 5.64l-2.12 2.12M7.76 16.24l-2.12 2.12M18.36 18.36l-2.12-2.12M7.76 7.76 5.64 5.64" stroke="currentColor" />
    </svg>
  );
}

function XpLedgerIcon({ className }: IconProps) {
  return (
    <svg className={iconStroke(className)} fill="none" viewBox="0 0 24 24">
      <path d="M6 5h12v14H6z" stroke="currentColor" />
      <path d="M9 9h6M9 12h6M9 15h3" stroke="currentColor" />
      <path d="m15 15 1.5 1.5L19 14" stroke="currentColor" />
    </svg>
  );
}

const adminLinks = [
  { href: "/admin", label: "Overview", icon: OverviewIcon },
  { href: "/admin/courses", label: "Courses", icon: CoursesIcon },
  { href: "/admin/recommendations", label: "Recommendations", icon: RecommendationsIcon },
  { href: "/admin/campaigns", label: "Campaigns", icon: CampaignsIcon },
  { href: "/admin/rewards", label: "Rewards", icon: RewardsIcon },
  { href: "/admin/rewards/perks", label: "Perks", icon: PerksIcon },
  { href: "/admin/inventory/new", label: "Inventory", icon: InventoryIcon },
  { href: "/admin/redemptions", label: "Redemptions", icon: RedemptionsIcon },
  { href: "/admin/missions", label: "Missions", icon: MissionsIcon },
  { href: "/admin/content", label: "Content", icon: ContentIcon },
  { href: "/admin/proofs", label: "Proofs", icon: ProofsIcon },
  { href: "/admin/users", label: "Users", icon: UsersIcon },
  { href: "/admin/xp-settings", label: "XP Settings", icon: XpSettingsIcon },
  { href: "/admin/xp-ledger", label: "XP Ledger", icon: XpLedgerIcon },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/admin") {
    return pathname === href;
  }

  if (href === "/admin/rewards" && pathname.startsWith("/admin/rewards/perks")) {
    return false;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell({
  children,
  profile,
}: {
  children: ReactNode;
  profile: UserProfile;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <main className="min-h-screen bg-[var(--ve-panel)] text-[var(--foreground)]">
      <div className="flex min-h-screen w-full">
        <aside
          className={cn(
            "sticky top-0 hidden h-screen shrink-0 border-r border-[#e3ded5] bg-[var(--ve-shell)] px-4 py-6 transition-[width] duration-200 md:flex md:flex-col",
            collapsed ? "w-20" : "w-72",
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className={cn(collapsed && "sr-only")}>
              <Link
                href="/dashboard"
                className="text-xs font-black uppercase tracking-[0.16em] text-[#087f5b]"
              >
                Project VE
              </Link>
              <h1 className="mt-2 text-2xl font-black">Admin</h1>
            </div>
            {collapsed ? (
              <Link
                aria-label="Project VE admin"
                className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[#e4f4ed] text-sm font-black text-[#087f5b]"
                href="/admin"
              >
                VE
              </Link>
            ) : null}
            <button
              aria-label={collapsed ? "Expand admin sidebar" : "Collapse admin sidebar"}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[var(--ve-panel)] text-[var(--foreground)] hover:bg-[#e8e1d7]"
              onClick={() => setCollapsed((value) => !value)}
              type="button"
            >
              {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
            </button>
          </div>

          <nav className="mt-8 space-y-1">
            {adminLinks.map((link) => (
              (() => {
                const Icon = link.icon;
                return (
                  <Link
                    aria-label={collapsed ? link.label : undefined}
                    className={cn(
                      "flex min-h-10 items-center rounded-[12px] text-sm font-bold text-[#5f5f5a] hover:bg-[var(--ve-panel)] hover:text-[var(--foreground)]",
                      collapsed ? "justify-center px-2" : "gap-3 px-3 py-2",
                      isActivePath(pathname, link.href) && "bg-[#e4f4ed] text-[#087f5b]",
                    )}
                    href={link.href}
                    key={link.href}
                    title={collapsed ? link.label : undefined}
                  >
                    <Icon />
                    {collapsed ? <span className="sr-only">{link.label}</span> : link.label}
                  </Link>
                );
              })()
            ))}
          </nav>

          {collapsed ? null : (
            <div className="mt-auto rounded-[16px] bg-[var(--ve-card-muted)] p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">
                Signed in
              </p>
              <p className="mt-1 truncate text-sm font-black">
                {profile.display_name ?? "Admin"}
              </p>
              <p className="mt-1 text-xs font-bold capitalize text-[#087f5b]">{profile.role}</p>
            </div>
          )}
        </aside>

        <section className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b border-[#e3ded5] bg-[var(--ve-shell)]/95 px-5 py-4 backdrop-blur md:hidden">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#087f5b]">
                  Project VE
                </p>
                <h1 className="text-xl font-black">Admin</h1>
              </div>
              <Link className="text-sm font-black" href="/dashboard">
                App
              </Link>
            </div>
            <nav className="hide-scrollbar mt-4 flex gap-2 overflow-x-auto">
              {adminLinks.map((link) => (
                <Link
                  className="shrink-0 rounded-[12px] bg-[var(--ve-panel)] px-3 py-2 text-xs font-black"
                  href={link.href}
                  key={link.href}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </header>
          <div className="px-5 py-6 md:px-8 md:py-8">{children}</div>
        </section>
      </div>
    </main>
  );
}
