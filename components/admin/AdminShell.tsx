"use client";

import * as Collapsible from "@radix-ui/react-collapsible";
import * as Select from "@radix-ui/react-select";
import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeftIcon, ChevronRightIcon, HelpCircleIcon, MenuIcon } from "@/components/ui/Icons";
import {
  AdminActivityIcon,
  AdminAddBoxIcon,
  AdminAssessmentsIcon,
  AdminCohortsIcon,
  AdminCoursesIcon,
  AdminFlagIcon,
  AdminInterventionsIcon,
  AdminMissionsIcon,
  AdminMonitoringIcon,
  AdminOverviewIcon,
  AdminPeopleIcon,
  AdminPointsIcon,
  AdminProgrammesIcon,
  AdminRecommendationsIcon,
  AdminReportingIcon,
  AdminRewardsIcon,
  AdminRuleIcon,
  AdminSettingsIcon,
  AdminSupportAgentIcon,
} from "@/components/admin/AdminIcons";
import { PLATFORM_CATALOG_WORKSPACE_ID, workspaceHasAnyRole } from "@/features/admin/shared/workspace";
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
  roles?: string[];
  /**
   * Hidden in the Project VE Platform Catalog pseudo-workspace — for links
   * that only make sense for a real organisation (people, cohorts, XP
   * ledger, activity, reporting), not for platform-owned content.
   */
  hiddenForCatalog?: boolean;
  /**
   * Shown ONLY in the Project VE Platform Catalog pseudo-workspace — the
   * inverse of hiddenForCatalog, for links that only make sense there (e.g.
   * staffing the catalog itself), never for a real organisation.
   */
  catalogOnly?: boolean;
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
      { href: "/admin/assessments", label: "Assessments", icon: RecommendationsIcon },
      { href: "/admin/cohorts", label: "Cohorts", icon: CohortsIcon },
      { href: "/admin/instructor", label: "Instructor workspace", icon: CohortsIcon },
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
      { href: "/admin/xp-ledger", label: "XP activity", icon: XpLedgerIcon },
    ],
  },
  {
    id: "governance",
    label: "Governance",
    summary: "Organisation oversight and audit",
    links: [
      { href: "/admin/organizations", label: "Organisations", icon: UsersIcon },
      { href: "/admin/users", label: "Users", icon: UsersIcon },
      { href: "/admin/activity", label: "Activity history", icon: XpLedgerIcon },
    ],
  },
  {
    id: "settings",
    label: "Platform Settings",
    summary: "Platform configuration",
    links: [{ href: "/admin/xp-settings", label: "XP settings", icon: XpSettingsIcon }],
  },
];

function canUseAdminLink(link: AdminLink, workspace: ResolvedAdminWorkspace) {
  if (workspace.type === "platform") {
    return true;
  }

  if (link.href === "/admin") return true;
  if (link.href.startsWith("/admin/courses")) {
    return workspaceHasAnyRole(workspace, [
      "organisation_owner",
      "organisation_admin",
      "programme_manager",
      "content_editor",
      "reviewer",
    ]);
  }
  if (link.href.startsWith("/admin/programmes")) {
    return workspaceHasAnyRole(workspace, ["organisation_owner", "organisation_admin", "programme_manager"]);
  }
  if (link.href.startsWith("/admin/assessments")) {
    return workspaceHasAnyRole(workspace, [
      "organisation_owner",
      "organisation_admin",
      "programme_manager",
      "content_editor",
    ]);
  }
  if (link.href.startsWith("/admin/cohorts")) {
    return workspaceHasAnyRole(workspace, [
      "organisation_owner",
      "organisation_admin",
      "programme_manager",
    ]);
  }
  if (link.href.startsWith("/admin/instructor")) {
    return workspaceHasAnyRole(workspace, [
      "organisation_owner",
      "organisation_admin",
      "programme_manager",
      "reviewer",
      "instructor",
      "report_viewer",
    ]);
  }
  if (link.href.startsWith("/admin/reporting")) {
    return workspaceHasAnyRole(workspace, [
      "organisation_owner",
      "organisation_admin",
      "programme_manager",
      "report_viewer",
    ]);
  }
  if (link.href.startsWith("/admin/interventions")) {
    return workspaceHasAnyRole(workspace, [
      "organisation_owner",
      "organisation_admin",
      "programme_manager",
    ]);
  }
  if (link.href.startsWith("/admin/rewards")) {
    return workspaceHasAnyRole(workspace, ["organisation_owner", "organisation_admin", "programme_manager"]);
  }
  if (link.href.startsWith("/admin/missions")) {
    return workspaceHasAnyRole(workspace, [
      "organisation_owner",
      "organisation_admin",
      "programme_manager",
      "content_editor",
    ]);
  }
  if (link.href.startsWith("/admin/activity")) {
    return workspaceHasAnyRole(workspace, ["organisation_owner", "organisation_admin"]);
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
  } else if (pathname.startsWith("/admin/activity")) {
    crumbs.push({ href: pathname, label: "Organisation activity" });
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
    document.cookie = `project-ve-admin-workspace=${encodeURIComponent(value)}; path=/; SameSite=Lax`;
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

const orgPrimaryLinks: AdminLink[] = [
  { href: "/admin", label: "Overview", icon: AdminOverviewIcon },
  {
    href: "/admin/people",
    label: "People",
    icon: AdminPeopleIcon,
    roles: ["organisation_owner", "organisation_admin"],
    hiddenForCatalog: true,
  },
  {
    href: "/admin/catalog-people",
    label: "Catalog Staff",
    icon: AdminPeopleIcon,
    roles: ["organisation_owner", "organisation_admin"],
    catalogOnly: true,
  },
  {
    href: "/admin/programmes",
    label: "Programmes",
    icon: AdminProgrammesIcon,
    roles: ["organisation_owner", "organisation_admin", "programme_manager"],
    hiddenForCatalog: true,
  },
  {
    href: "/admin/cohorts",
    label: "Cohorts",
    icon: AdminCohortsIcon,
    roles: ["organisation_owner", "organisation_admin", "programme_manager"],
    hiddenForCatalog: true,
  },
  {
    href: "/admin/instructor",
    label: "Instructor workspace",
    icon: AdminSupportAgentIcon,
    roles: ["organisation_owner", "organisation_admin", "programme_manager", "reviewer", "instructor", "report_viewer"],
    hiddenForCatalog: true,
  },
  {
    href: "/admin/courses",
    label: "Courses",
    icon: AdminCoursesIcon,
    roles: ["organisation_owner", "organisation_admin", "programme_manager", "content_editor", "reviewer"],
  },
  {
    href: "/admin/missions",
    label: "Missions",
    icon: AdminMissionsIcon,
    roles: ["organisation_owner", "organisation_admin", "programme_manager", "content_editor"],
  },
  {
    href: "/admin/proofs",
    label: "Proof reviews",
    icon: AdminMonitoringIcon,
    roles: ["organisation_owner", "organisation_admin", "programme_manager", "reviewer", "instructor"],
  },
  {
    href: "/admin/interventions",
    label: "Interventions",
    icon: AdminInterventionsIcon,
    roles: ["organisation_owner", "organisation_admin", "programme_manager"],
    hiddenForCatalog: true,
  },
  {
    href: "/admin/xp-ledger",
    label: "Points",
    icon: AdminPointsIcon,
    roles: ["organisation_owner", "organisation_admin"],
  },
  {
    href: "/admin/rewards",
    label: "Rewards",
    icon: AdminRewardsIcon,
    roles: ["organisation_owner", "organisation_admin", "programme_manager"],
  },
  {
    href: "/admin/campaigns",
    label: "Reward Campaigns",
    icon: AdminFlagIcon,
    roles: ["organisation_owner", "organisation_admin", "programme_manager"],
    catalogOnly: true,
  },
  {
    href: "/admin/rewards/perks",
    label: "Perks",
    icon: AdminFlagIcon,
    roles: ["organisation_owner", "organisation_admin", "programme_manager"],
  },
  {
    href: "/admin/inventory/new",
    label: "Inventory",
    icon: AdminAddBoxIcon,
    roles: ["organisation_owner", "organisation_admin", "programme_manager"],
  },
  {
    href: "/admin/redemptions",
    label: "Redemptions",
    icon: AdminRuleIcon,
    roles: ["organisation_owner", "organisation_admin", "programme_manager"],
  },
  {
    href: "/admin/assessments",
    label: "Assessments",
    icon: AdminAssessmentsIcon,
    roles: ["organisation_owner", "organisation_admin", "programme_manager", "content_editor"],
  },
  {
    href: "/admin/recommendations",
    label: "Recommendations",
    icon: AdminRecommendationsIcon,
    roles: ["organisation_owner", "organisation_admin", "programme_manager", "content_editor"],
  },
  {
    href: "/admin/reporting",
    label: "Reporting",
    icon: AdminReportingIcon,
    roles: ["organisation_owner", "organisation_admin", "programme_manager", "report_viewer"],
    hiddenForCatalog: true,
  },
  {
    href: "/admin/activity",
    label: "Activity",
    icon: AdminActivityIcon,
    roles: ["organisation_owner", "organisation_admin"],
    hiddenForCatalog: true,
  },
];

const orgSettingsLink: AdminLink = { href: "/admin/xp-settings", label: "Settings", icon: AdminSettingsIcon };

function visibleOrgLinks(workspace: ResolvedAdminWorkspace) {
  const isCatalogWorkspace = workspace.id === PLATFORM_CATALOG_WORKSPACE_ID;

  return orgPrimaryLinks.filter((link) => {
    if (isCatalogWorkspace && link.hiddenForCatalog) {
      return false;
    }

    if (!isCatalogWorkspace && link.catalogOnly) {
      return false;
    }

    return !link.roles || workspaceHasAnyRole(workspace, link.roles);
  });
}

function OrgWorkspaceIdentity({
  collapsed = false,
  contexts,
  currentWorkspace,
}: {
  collapsed?: boolean;
  contexts: AdminOrganizationContext[];
  currentWorkspace: ResolvedAdminWorkspace;
}) {
  const router = useRouter();
  const orgContexts = useMemo(
    () => contexts.filter((context) => context.type === "organization"),
    [contexts],
  );
  // Only present for platform admins — lets them step back out of any
  // organisation (or the platform-catalog pseudo-workspace) they entered,
  // since org contexts alone offer no way back to platform-wide oversight.
  const platformContext = contexts.find((context) => context.type === "platform");
  const selected = orgContexts.find((context) => context.id === currentWorkspace.id);
  const identity = currentWorkspace.organizationIdentity;
  const displayName = identity?.shortName ?? identity?.name ?? selected?.label ?? "Organisation";
  const initials = displayName.slice(0, 2).toUpperCase();

  function handleChange(value: string) {
    document.cookie = `project-ve-admin-workspace=${encodeURIComponent(value)}; path=/; SameSite=Lax`;
    router.refresh();
  }

  if (collapsed) {
    return (
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--admin-primary-container)] font-black text-[var(--admin-on-primary)]">
        {initials}
      </div>
    );
  }

  return (
    <Select.Root value={currentWorkspace.id} onValueChange={handleChange}>
      <Select.Trigger className="flex items-center gap-2 rounded-lg px-1 py-1 text-left outline-none transition hover:bg-[var(--admin-surface-container-low)]">
        <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-[var(--admin-border-warm)] bg-[var(--admin-surface-container-low)]">
          {identity?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={displayName} className="h-full w-full object-cover" src={identity.logoUrl} />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-xs font-black text-[var(--admin-on-surface-variant)]">
              {initials}
            </span>
          )}
        </div>
        <span className="flex flex-col leading-tight">
          <span className="text-sm font-black text-[var(--admin-on-surface)]">{displayName}</span>
          <span className="flex items-center gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--admin-on-surface-variant)]">
              {selected?.roleLabel ?? "Admin"}
            </span>
            {identity ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[color:color-mix(in_srgb,var(--admin-primary-container)_16%,transparent)] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-[var(--admin-primary)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--admin-primary-container)]" />
                {identity.lifecycleStatus}
              </span>
            ) : null}
          </span>
        </span>
        {orgContexts.length > 1 || platformContext ? (
          <Select.Icon className="ml-1 text-[var(--admin-on-surface-variant)]">
            <ChevronRightIcon className="h-3.5 w-3.5 rotate-90" />
          </Select.Icon>
        ) : null}
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          align="start"
          className="z-50 min-w-[16rem] overflow-hidden rounded-[14px] border border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] p-1 shadow-xl"
          position="popper"
        >
          <Select.Viewport>
            {platformContext ? (
              <>
                <Select.Item
                  className="cursor-pointer rounded-[10px] px-3 py-2 text-sm font-bold outline-none data-[highlighted]:bg-[var(--admin-surface-container-low)]"
                  value={platformContext.id}
                >
                  <Select.ItemText>{platformContext.label}</Select.ItemText>
                </Select.Item>
                <div className="my-1 h-px bg-[var(--admin-border-warm)]" role="separator" />
              </>
            ) : null}
            {orgContexts.map((context) => (
              <Select.Item
                className="cursor-pointer rounded-[10px] px-3 py-2 text-sm font-bold outline-none data-[highlighted]:bg-[var(--admin-surface-container-low)]"
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
  );
}

function OrgSideNav({ pathname, workspace }: { pathname: string; workspace: ResolvedAdminWorkspace }) {
  return (
    <nav className="fixed left-0 top-0 hidden h-screen w-20 flex-col items-center border-r border-[var(--admin-border-warm)] bg-[var(--admin-surface-container-low)] py-6 md:flex xl:hidden">
      <Link
        className="mb-8 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--admin-primary-container)] text-sm font-black text-[var(--admin-on-primary)]"
        href="/admin"
      >
        Ve
      </Link>
      <ul className="flex flex-1 flex-col items-center gap-2">
        {visibleOrgLinks(workspace).map((link) => {
          const Icon = link.icon;
          const active = isActivePath(pathname, link.href);
          return (
            <li key={link.href}>
              <Link
                aria-current={active ? "page" : undefined}
                aria-label={link.label}
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-lg text-[var(--admin-on-surface-variant)] transition hover:bg-[var(--admin-surface-container-high)] hover:text-[var(--admin-primary)]",
                  active && "bg-[color:color-mix(in_srgb,var(--admin-primary-container)_14%,transparent)] text-[var(--admin-primary)]",
                )}
                href={link.href}
                title={link.label}
              >
                <Icon />
              </Link>
            </li>
          );
        })}
      </ul>
      <Link
          aria-label={orgSettingsLink.label}
          className={cn(
            "mt-4 flex h-11 w-11 items-center justify-center rounded-lg text-[var(--admin-on-surface-variant)] transition hover:bg-[var(--admin-surface-container-high)] hover:text-[var(--admin-primary)]",
            isActivePath(pathname, orgSettingsLink.href) &&
              "bg-[color:color-mix(in_srgb,var(--admin-primary-container)_14%,transparent)] text-[var(--admin-primary)]",
          )}
          href={orgSettingsLink.href}
          title={orgSettingsLink.label}
        >
          <orgSettingsLink.icon />
        </Link>
    </nav>
  );
}

function OrgSideNavExpanded({ pathname, workspace }: { pathname: string; workspace: ResolvedAdminWorkspace }) {
  return (
    <nav className="fixed left-0 top-0 hidden h-screen w-72 flex-col overflow-y-auto border-r border-[var(--admin-border-warm)] bg-[var(--admin-surface-container-low)] p-4 xl:flex">
      <div className="mb-6 flex items-center gap-3 px-1">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--admin-border-warm)] bg-[var(--admin-surface-container-low)] font-black text-[var(--admin-primary)]">
          Ve
        </div>
        <div>
          <p className="font-black leading-tight text-[var(--admin-brand-hero)]">Project Ve</p>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--admin-on-surface-variant)]">
            Admin workspace
          </p>
        </div>
      </div>
      <ul className="flex flex-1 flex-col gap-1">
        {visibleOrgLinks(workspace).map((link) => (
          <li key={link.href}>
            <AdminNavLink link={link} pathname={pathname} />
          </li>
        ))}
      </ul>
      <div className="mt-auto border-t border-[var(--admin-border-warm)] pt-3">
        <AdminNavLink link={orgSettingsLink} pathname={pathname} />
      </div>
    </nav>
  );
}

function OrgTopBar({
  currentWorkspace,
  organizationContexts,
}: {
  currentWorkspace: ResolvedAdminWorkspace;
  organizationContexts: AdminOrganizationContext[];
}) {
  return (
    <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] px-6">
      <OrgWorkspaceIdentity contexts={organizationContexts} currentWorkspace={currentWorkspace} />
      <div className="flex items-center gap-3">
        <Link
          aria-label="Help and support"
          className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--admin-on-surface-variant)] transition hover:bg-[var(--admin-surface-container-low)] hover:text-[var(--admin-primary)]"
          href="/support"
        >
          <HelpCircleIcon className="h-5 w-5" />
        </Link>
      </div>
    </header>
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

  if (currentWorkspace.type === "organization") {
    return (
      <main className="min-h-screen bg-[var(--admin-surface)] text-[var(--admin-on-surface)]">
        <OrgSideNav pathname={pathname} workspace={currentWorkspace} />
        <OrgSideNavExpanded pathname={pathname} workspace={currentWorkspace} />
        <div className="flex min-h-screen flex-col md:pl-20 xl:pl-72">
          <OrgTopBar currentWorkspace={currentWorkspace} organizationContexts={organizationContexts} />
          <header className="sticky top-0 z-20 border-b border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)]/95 px-5 py-4 backdrop-blur md:hidden">
            <div className="flex items-center justify-between">
              <OrgWorkspaceIdentity contexts={organizationContexts} currentWorkspace={currentWorkspace} />
              <Link className="text-sm font-black text-[var(--admin-primary)]" href="/dashboard">
                App
              </Link>
            </div>
            <Collapsible.Root className="mt-4" onOpenChange={setMobileNavOpen} open={mobileNavOpen}>
              <Collapsible.Trigger className="flex w-full items-center justify-between rounded-[14px] bg-[var(--admin-surface-container-low)] px-4 py-3 text-sm font-black text-[var(--admin-on-surface)]">
                <span className="inline-flex items-center gap-2">
                  <MenuIcon className="h-4 w-4" />
                  Admin navigation
                </span>
                <ChevronRightIcon className={cn("h-4 w-4 transition", mobileNavOpen && "rotate-90")} />
              </Collapsible.Trigger>
              <Collapsible.Content className="mt-3 max-h-[68vh] overflow-y-auto rounded-[16px] border border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] p-3 shadow-lg">
                <nav className="grid gap-1">
                  {visibleOrgLinks(currentWorkspace).map((link) => (
                    <AdminNavLink key={link.href} link={link} pathname={pathname} />
                  ))}
                  <div className="mt-2 border-t border-[var(--admin-border-warm)] pt-2">
                    <AdminNavLink link={orgSettingsLink} pathname={pathname} />
                  </div>
                </nav>
              </Collapsible.Content>
            </Collapsible.Root>
          </header>
          <div className="flex-1 px-5 py-6 md:px-8 md:py-8">
            <AdminBreadcrumbs pathname={pathname} />
            {children}
          </div>
        </div>
      </main>
    );
  }

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
