"use client";

import * as Collapsible from "@radix-ui/react-collapsible";
import * as Select from "@radix-ui/react-select";
import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeftIcon, ChevronRightIcon, MenuIcon } from "@/components/ui/Icons";
import type { AdminOrganizationContext, AdminWorkspace as ResolvedAdminWorkspace } from "@/lib/admin";
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

function ProgrammesIcon({ className }: IconProps) {
  return (
    <svg className={iconStroke(className)} fill="none" viewBox="0 0 24 24">
      <path d="M5 5h14v5H5zM5 14h6v5H5zM15 14h4v5h-4z" stroke="currentColor" />
      <path d="M12 7.5h3M8 16.5h1M17 16.5h.5" stroke="currentColor" />
    </svg>
  );
}

function CohortsIcon({ className }: IconProps) {
  return (
    <svg className={iconStroke(className)} fill="none" viewBox="0 0 24 24">
      <path d="M8.5 11a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM15.5 11a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" stroke="currentColor" />
      <path d="M4.5 18a4 4 0 0 1 8 0M11.5 18a4 4 0 0 1 8 0" stroke="currentColor" />
    </svg>
  );
}

function ReportingIcon({ className }: IconProps) {
  return (
    <svg className={iconStroke(className)} fill="none" viewBox="0 0 24 24">
      <path d="M5 19V5M5 19h14" stroke="currentColor" />
      <path d="M8 15v-4M12 15V8M16 15v-6" stroke="currentColor" />
      <path d="M8 18h8" stroke="currentColor" />
    </svg>
  );
}

function InterventionsIcon({ className }: IconProps) {
  return (
    <svg className={iconStroke(className)} fill="none" viewBox="0 0 24 24">
      <path d="M12 4 4 18h16z" stroke="currentColor" />
      <path d="M12 9v4M12 16h.01" stroke="currentColor" />
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

function AdsIcon({ className }: IconProps) {
  return (
    <svg className={iconStroke(className)} fill="none" viewBox="0 0 24 24">
      <path d="M4 6h16v12H4z" stroke="currentColor" />
      <path d="M8 10h5M8 13h8" stroke="currentColor" />
      <path d="M17 6v12" stroke="currentColor" />
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

type AdminLink = {
  href: string;
  label: string;
  icon: (props: IconProps) => ReactNode;
};

type AdminLinkGroup = {
  id: string;
  label: string;
  summary: string;
  links: AdminLink[];
};

const adminLinkGroups: AdminLinkGroup[] = [
  {
    id: "home",
    label: "Home",
    summary: "Command centre",
    links: [{ href: "/admin", label: "Overview", icon: OverviewIcon }],
  },
  {
    id: "learning",
    label: "Learning",
    summary: "Courses and learning content",
    links: [
      { href: "/admin/courses", label: "Courses", icon: CoursesIcon },
      { href: "/admin/programmes", label: "Programmes", icon: ProgrammesIcon },
      { href: "/admin/cohorts", label: "Cohorts", icon: CohortsIcon },
      { href: "/admin/reporting", label: "Reporting", icon: ReportingIcon },
      { href: "/admin/interventions", label: "Interventions", icon: InterventionsIcon },
      { href: "/admin/recommendations", label: "Recommendations", icon: RecommendationsIcon },
      { href: "/admin/content", label: "Content", icon: ContentIcon },
    ],
  },
  {
    id: "engagement",
    label: "Engagement",
    summary: "Missions, campaigns, and rewards",
    links: [
      { href: "/admin/missions", label: "Missions", icon: MissionsIcon },
      { href: "/admin/campaigns", label: "Campaigns", icon: CampaignsIcon },
      { href: "/admin/ads", label: "Ads", icon: AdsIcon },
      { href: "/admin/rewards", label: "Rewards", icon: RewardsIcon },
      { href: "/admin/rewards/perks", label: "Perks", icon: PerksIcon },
      { href: "/admin/inventory/new", label: "Inventory", icon: InventoryIcon },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    summary: "Moderation and admin activity",
    links: [
      { href: "/admin/redemptions", label: "Redemptions", icon: RedemptionsIcon },
      { href: "/admin/proofs", label: "Proof reviews", icon: ProofsIcon },
      { href: "/admin/organizations", label: "Organisations", icon: UsersIcon },
      { href: "/admin/users", label: "Users", icon: UsersIcon },
      { href: "/admin/xp-ledger", label: "XP activity", icon: XpLedgerIcon },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    summary: "Platform configuration",
    links: [{ href: "/admin/xp-settings", label: "XP settings", icon: XpSettingsIcon }],
  },
];

function hasAnyRole(workspace: ResolvedAdminWorkspace, roles: string[]) {
  return workspace.type === "platform" || roles.some((role) => workspace.roles.includes(role));
}

function canUseAdminLink(link: AdminLink, workspace: ResolvedAdminWorkspace) {
  if (workspace.type === "platform") {
    return true;
  }

  if (link.href === "/admin") return true;
  if (link.href.startsWith("/admin/courses")) {
    return hasAnyRole(workspace, [
      "organisation_owner",
      "organisation_admin",
      "programme_manager",
      "content_editor",
      "reviewer",
    ]);
  }
  if (link.href.startsWith("/admin/programmes")) {
    return hasAnyRole(workspace, ["organisation_owner", "organisation_admin", "programme_manager"]);
  }
  if (link.href.startsWith("/admin/cohorts")) {
    return hasAnyRole(workspace, [
      "organisation_owner",
      "organisation_admin",
      "programme_manager",
      "instructor",
    ]);
  }
  if (link.href.startsWith("/admin/reporting")) {
    return hasAnyRole(workspace, [
      "organisation_owner",
      "organisation_admin",
      "programme_manager",
      "instructor",
      "report_viewer",
    ]);
  }
  if (link.href.startsWith("/admin/interventions")) {
    return hasAnyRole(workspace, [
      "organisation_owner",
      "organisation_admin",
      "programme_manager",
      "instructor",
    ]);
  }
  if (link.href.startsWith("/admin/rewards")) {
    return hasAnyRole(workspace, ["organisation_owner", "organisation_admin", "programme_manager"]);
  }
  if (link.href.startsWith("/admin/missions")) {
    return hasAnyRole(workspace, ["organisation_owner", "organisation_admin", "programme_manager"]);
  }

  return false;
}

function filterAdminLinkGroups(groups: AdminLinkGroup[], workspace: ResolvedAdminWorkspace) {
  return groups
    .map((group) => ({
      ...group,
      links: group.links.filter((link) => canUseAdminLink(link, workspace)),
    }))
    .filter((group) => group.links.length > 0);
}

const adminLinks = adminLinkGroups.flatMap((group) => group.links);

function isActivePath(pathname: string, href: string) {
  if (href === "/admin") {
    return pathname === href;
  }

  if (href === "/admin/rewards" && pathname.startsWith("/admin/rewards/perks")) {
    return false;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function getActiveGroupId(pathname: string) {
  return adminLinkGroups.find((group) =>
    group.links.some((link) => isActivePath(pathname, link.href)),
  )?.id;
}

function getDeepestActiveLink(pathname: string) {
  return [...adminLinks]
    .sort((left, right) => right.href.length - left.href.length)
    .find((link) => isActivePath(pathname, link.href));
}

function getBreadcrumbs(pathname: string) {
  const activeLink = getDeepestActiveLink(pathname);
  const activeGroup = adminLinkGroups.find((group) =>
    group.links.some((link) => link.href === activeLink?.href),
  );
  const crumbs = [{ href: "/admin", label: "Admin" }];

  if (!activeLink || activeLink.href === "/admin") {
    return crumbs;
  }

  if (activeGroup) {
    crumbs.push({ href: activeLink.href, label: activeGroup.label });
  }

  crumbs.push({ href: activeLink.href, label: activeLink.label });

  if (pathname.startsWith("/admin/courses/ai/new")) {
    crumbs.push({ href: pathname, label: "Create with AI" });
  } else if (pathname.startsWith("/admin/courses/ai/planner")) {
    crumbs.push({ href: pathname, label: "AI planner" });
  } else if (pathname.startsWith("/admin/courses/lessons/")) {
    crumbs.push({ href: pathname, label: "Lesson editor" });
  } else if (pathname.startsWith("/admin/courses/new")) {
    crumbs.push({ href: pathname, label: "Create course" });
  } else if (pathname.startsWith("/admin/courses/")) {
    crumbs.push({ href: pathname, label: "Course workspace" });
  } else if (pathname.startsWith("/admin/programmes/new")) {
    crumbs.push({ href: pathname, label: "Create programme" });
  } else if (pathname.startsWith("/admin/programmes/")) {
    crumbs.push({ href: pathname, label: "Programme workspace" });
  } else if (pathname.startsWith("/admin/cohorts/new")) {
    crumbs.push({ href: pathname, label: "Create cohort" });
  } else if (pathname.startsWith("/admin/cohorts/")) {
    crumbs.push({ href: pathname, label: "Cohort workspace" });
  } else if (pathname.startsWith("/admin/campaigns/new")) {
    crumbs.push({ href: pathname, label: "Create campaign" });
  } else if (pathname.startsWith("/admin/campaigns/")) {
    crumbs.push({ href: pathname, label: "Campaign workspace" });
  } else if (pathname.startsWith("/admin/missions/new")) {
    crumbs.push({ href: pathname, label: "Create mission" });
  } else if (pathname.startsWith("/admin/missions/")) {
    crumbs.push({ href: pathname, label: "Mission workspace" });
  } else if (pathname.startsWith("/admin/rewards/perks/new")) {
    crumbs.push({ href: pathname, label: "Create perk" });
  } else if (pathname.startsWith("/admin/rewards/perks/")) {
    crumbs.push({ href: pathname, label: "Perk workspace" });
  } else if (pathname.startsWith("/admin/rewards/new")) {
    crumbs.push({ href: pathname, label: "Create reward" });
  } else if (pathname.startsWith("/admin/rewards/")) {
    crumbs.push({ href: pathname, label: "Reward workspace" });
  } else if (pathname.startsWith("/admin/organizations")) {
    crumbs.push({ href: pathname, label: "Organisation workspaces" });
  } else if (pathname.startsWith("/admin/ads/")) {
    crumbs.push({
      href: pathname,
      label: pathname.split("/").at(-1)?.replaceAll("-", " ") ?? "Ads workflow",
    });
  }

  return crumbs.filter(
    (crumb, index, allCrumbs) =>
      index === allCrumbs.findIndex((candidate) => candidate.label === crumb.label),
  );
}

function AdminNavLink({
  collapsed = false,
  link,
  pathname,
}: {
  collapsed?: boolean;
  link: AdminLink;
  pathname: string;
}) {
  const Icon = link.icon;
  const active = isActivePath(pathname, link.href);

  return (
    <Link
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? link.label : undefined}
      className={cn(
        "flex min-h-10 items-center rounded-[12px] text-sm font-bold text-[var(--ve-muted-strong)] transition hover:bg-[var(--ve-panel)] hover:text-[var(--foreground)]",
        collapsed ? "justify-center px-2" : "gap-3 px-3 py-2",
        active &&
          "bg-[color:color-mix(in_srgb,var(--ve-green-soft)_82%,var(--ve-card))] text-[var(--ve-green)] shadow-sm ring-1 ring-[color:color-mix(in_srgb,var(--ve-green)_18%,transparent)]",
      )}
      href={link.href}
      title={collapsed ? link.label : undefined}
    >
      <Icon />
      {collapsed ? <span className="sr-only">{link.label}</span> : link.label}
    </Link>
  );
}

function AdminNavGroup({
  collapsed,
  defaultOpen,
  group,
  pathname,
}: {
  collapsed: boolean;
  defaultOpen: boolean;
  group: AdminLinkGroup;
  pathname: string;
}) {
  if (collapsed) {
    return (
      <div className="space-y-1 border-t border-[var(--ve-line-soft)] pt-3 first:border-t-0 first:pt-0">
        <p className="sr-only">{group.label}</p>
        {group.links.map((link) => (
          <AdminNavLink collapsed key={link.href} link={link} pathname={pathname} />
        ))}
      </div>
    );
  }

  return (
    <Collapsible.Root className="space-y-2" defaultOpen={defaultOpen}>
      <Collapsible.Trigger className="group flex w-full items-center justify-between rounded-[12px] px-2 py-2 text-left transition hover:bg-[var(--ve-panel)]">
        <span>
          <span className="block text-[11px] font-black uppercase tracking-[0.16em] text-[var(--ve-muted)]">
            {group.label}
          </span>
          <span className="mt-0.5 block text-xs font-semibold text-[var(--ve-muted-strong)]">
            {group.summary}
          </span>
        </span>
        <ChevronRightIcon className="h-4 w-4 text-[var(--ve-muted)] transition group-data-[state=open]:rotate-90" />
      </Collapsible.Trigger>
      <Collapsible.Content className="space-y-1">
        {group.links.map((link) => (
          <AdminNavLink key={link.href} link={link} pathname={pathname} />
        ))}
      </Collapsible.Content>
    </Collapsible.Root>
  );
}

function AdminBreadcrumbs({ pathname }: { pathname: string }) {
  const breadcrumbs = getBreadcrumbs(pathname);

  if (breadcrumbs.length <= 1) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-2 text-xs font-black">
      {breadcrumbs.map((crumb, index) => {
        const isLast = index === breadcrumbs.length - 1;

        return (
          <span className="inline-flex items-center gap-2" key={`${crumb.href}-${crumb.label}`}>
            {index > 0 ? <span className="text-[var(--ve-muted)]">/</span> : null}
            {isLast ? (
              <span className="capitalize text-[var(--foreground)]">{crumb.label}</span>
            ) : (
              <Link
                className="capitalize text-[var(--ve-muted-strong)] hover:text-[var(--ve-green)]"
                href={crumb.href}
              >
                {crumb.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}

function WorkspaceSwitcher({
  collapsed = false,
  contexts,
  currentWorkspace,
}: {
  collapsed?: boolean;
  contexts: AdminOrganizationContext[];
  currentWorkspace: ResolvedAdminWorkspace;
}) {
  const router = useRouter();
  const contextOptions = useMemo(() => contexts.length > 0
    ? contexts
    : [{
      accentToken: "green",
      id: "platform",
      label: "Project VE platform",
      logoUrl: null,
      role: "platform_admin",
      roleLabel: "Platform admin",
      shortName: "Project VE",
      slug: "platform",
      type: "platform" as const,
      verificationStatus: "verified",
    }], [contexts]);
  const [selectedId, setSelectedId] = useState(currentWorkspace.id);
  const selectedContext = useMemo(
    () => contextOptions.find((context) => context.id === selectedId) ?? contextOptions[0],
    [contextOptions, selectedId],
  );

  useEffect(() => {
    if (contextOptions.some((context) => context.id === currentWorkspace.id)) {
      setSelectedId(currentWorkspace.id);
      return;
    }

    setSelectedId(contextOptions[0]?.id ?? "platform");
  }, [contextOptions, currentWorkspace.id]);

  function handleChange(value: string) {
    setSelectedId(value);
    document.cookie = `project-ve-admin-workspace=${encodeURIComponent(value)}; path=/admin; SameSite=Lax`;
    router.refresh();
  }

  const selectedLabel = selectedContext?.shortName ?? selectedContext?.label ?? "Project VE platform";

  if (collapsed) {
    return (
      <div className="mt-6 flex h-10 w-10 items-center justify-center rounded-[14px] border border-[var(--ve-line-soft)] bg-[var(--ve-card-muted)] text-xs font-black text-[var(--ve-green)]">
        {selectedContext?.type === "platform" ? "P" : selectedLabel.slice(0, 2).toUpperCase()}
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-[16px] border border-[var(--ve-line-soft)] bg-[var(--ve-card-muted)] p-4">
      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">
        Workspace
      </p>
      <Select.Root value={selectedContext?.id ?? "platform"} onValueChange={handleChange}>
        <Select.Trigger className="mt-2 flex min-h-11 w-full items-center justify-between rounded-[12px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] px-3 text-left text-sm font-black outline-none transition focus:border-[var(--ve-green)] focus:ring-4 focus:ring-[color:color-mix(in_srgb,var(--ve-green)_10%,transparent)]">
          <Select.Value />
          <Select.Icon className="text-[var(--ve-muted)]">v</Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content
            align="start"
            className="z-50 min-w-[18rem] overflow-hidden rounded-[14px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] p-1 shadow-xl"
            position="popper"
          >
            <Select.Viewport>
              {contextOptions.map((context) => (
                <Select.Item
                  className="cursor-pointer rounded-[10px] px-3 py-2 text-sm font-bold outline-none data-[highlighted]:bg-[var(--ve-panel)]"
                  key={context.id}
                  value={context.id}
                >
                  <Select.ItemText>{context.label}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
      <p className="mt-2 text-xs font-semibold text-[var(--ve-muted-strong)]">
        {selectedContext?.roleLabel ?? "Platform admin"}
      </p>
      {selectedContext?.type === "organization" ? (
        <p className="mt-1 text-xs font-black capitalize text-[var(--ve-green)]">
          {selectedContext.verificationStatus.replaceAll("_", " ")}
        </p>
      ) : null}
    </div>
  );
}

export function AdminShell({
  children,
  currentWorkspace,
  organizationContexts,
  profile,
}: {
  children: ReactNode;
  currentWorkspace: ResolvedAdminWorkspace;
  organizationContexts: AdminOrganizationContext[];
  profile: UserProfile;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const visibleLinkGroups = useMemo(
    () => filterAdminLinkGroups(adminLinkGroups, currentWorkspace),
    [currentWorkspace],
  );
  const activeGroupId = getActiveGroupId(pathname);

  return (
    <main className="min-h-screen bg-[var(--ve-panel)] text-[var(--foreground)]">
      <div className="flex min-h-screen w-full">
        <aside
          className={cn(
            "sticky top-0 hidden h-screen shrink-0 border-r border-[var(--ve-line-soft)] bg-[var(--ve-shell)] px-4 py-6 transition-[width] duration-200 md:flex md:flex-col",
            collapsed ? "w-20" : "w-72",
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className={cn(collapsed && "sr-only")}>
              <Link
                href="/dashboard"
                className="text-xs font-black uppercase tracking-[0.16em] text-[var(--ve-green)]"
              >
                Project VE
              </Link>
              <h1 className="mt-2 text-2xl font-black">Admin</h1>
            </div>
            {collapsed ? (
              <Link
                aria-label="Project VE admin"
                className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[color:color-mix(in_srgb,var(--ve-green-soft)_82%,var(--ve-card))] text-sm font-black text-[var(--ve-green)]"
                href="/admin"
              >
                VE
              </Link>
            ) : null}
            <button
              aria-label={collapsed ? "Expand admin sidebar" : "Collapse admin sidebar"}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[var(--ve-panel)] text-[var(--foreground)] hover:bg-[var(--ve-panel-soft)]"
              onClick={() => setCollapsed((value) => !value)}
              type="button"
            >
              {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
            </button>
          </div>

          <WorkspaceSwitcher
            collapsed={collapsed}
            contexts={organizationContexts}
            currentWorkspace={currentWorkspace}
          />

          <nav className="mt-6 space-y-4 overflow-y-auto pr-1">
            {visibleLinkGroups.map((group) => (
              <AdminNavGroup
                collapsed={collapsed}
                defaultOpen={group.id === activeGroupId || group.id === "home"}
                group={group}
                key={`${group.id}-${activeGroupId ?? "none"}`}
                pathname={pathname}
              />
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
              <p className="mt-1 text-xs font-bold capitalize text-[var(--ve-green)]">{profile.role}</p>
            </div>
          )}
        </aside>

        <section className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b border-[var(--ve-line-soft)] bg-[var(--ve-shell)]/95 px-5 py-4 backdrop-blur md:hidden">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-green)]">
                  Project VE
                </p>
                <h1 className="text-xl font-black">Admin</h1>
                <p className="mt-1 text-xs font-semibold text-[var(--ve-muted-strong)]">
                  {organizationContexts.length > 1
                    ? `${organizationContexts.length - 1} organisation contexts`
                    : "Project VE platform"}
                </p>
              </div>
              <Link className="text-sm font-black" href="/dashboard">
                App
              </Link>
            </div>
            <div className="md:hidden">
              <WorkspaceSwitcher
                contexts={organizationContexts}
                currentWorkspace={currentWorkspace}
              />
            </div>
            <Collapsible.Root className="mt-4" open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <Collapsible.Trigger className="flex w-full items-center justify-between rounded-[14px] bg-[var(--ve-panel)] px-4 py-3 text-sm font-black text-[var(--foreground)]">
                <span className="inline-flex items-center gap-2">
                  <MenuIcon className="h-4 w-4" />
                  Admin navigation
                </span>
                <ChevronRightIcon
                  className={cn("h-4 w-4 transition", mobileNavOpen && "rotate-90")}
                />
              </Collapsible.Trigger>
              <Collapsible.Content className="mt-3 max-h-[68vh] overflow-y-auto rounded-[16px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] p-3 shadow-lg">
                <nav className="space-y-4">
                  {visibleLinkGroups.map((group) => (
                    <section key={group.id}>
                      <p className="mb-2 px-1 text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">
                        {group.label}
                      </p>
                      <div className="grid gap-1">
                        {group.links.map((link) => (
                          <AdminNavLink key={link.href} link={link} pathname={pathname} />
                        ))}
                      </div>
                    </section>
                  ))}
                </nav>
              </Collapsible.Content>
            </Collapsible.Root>
          </header>
          <div className="px-5 py-6 md:px-8 md:py-8">
            <AdminBreadcrumbs pathname={pathname} />
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
