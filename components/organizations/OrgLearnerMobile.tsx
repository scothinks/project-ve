import Link from "next/link";
import type React from "react";
import { BottomNav } from "@/components/navigation/BottomNav";
import { ArrowLeftIcon } from "@/components/ui/Icons";
import { cn } from "@/lib/utils";

type OrgLearnerHeaderProps = {
  balance?: number | null;
  logoUrl?: string | null;
  organizationName: string;
  pointsLabel?: string | null;
  title?: string;
  workspaceSwitcher?: React.ReactNode;
};

type OrgNavItem = "Home" | "Lessons" | "Missions" | "Store" | "Orgs";

export function getOrgBottomNavHrefs(organizationSlug: string) {
  const base = `/o/${encodeURIComponent(organizationSlug)}`;

  return {
    Home: base,
    Lessons: `${base}/learn`,
    Missions: `${base}/missions`,
    Store: `${base}/rewards`,
    Orgs: "/org",
  };
}

export function OrgBottomNav({
  active,
  organizationSlug,
}: {
  active: OrgNavItem;
  organizationSlug: string;
}) {
  return (
    <BottomNav
      active={active === "Lessons" ? "Lesson" : active}
      hrefs={getOrgBottomNavHrefs(organizationSlug)}
    />
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "PV";
}

export function OrgLearnerHeader({
  balance,
  logoUrl,
  organizationName,
  pointsLabel,
  title,
  workspaceSwitcher,
}: OrgLearnerHeaderProps) {
  return (
    <header className="org-learner-header">
      <div className="org-learner-header__identity">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="" className="org-learner-header__logo" src={logoUrl} />
        ) : (
          <span className="org-learner-header__logo">{initials(organizationName)}</span>
        )}
        <div className="min-w-0">
          <p>{organizationName}</p>
          {title ? <span>{title}</span> : null}
        </div>
      </div>
      {typeof balance === "number" && pointsLabel ? (
        <OrgPointsPill balance={balance} label={pointsLabel} />
      ) : null}
      {workspaceSwitcher ? <div className="org-learner-header__switcher">{workspaceSwitcher}</div> : null}
    </header>
  );
}

export function OrgLearnerChrome({
  active,
  balance,
  logoUrl,
  organizationName,
  organizationSlug,
  pointsLabel,
  showMobileHeader = true,
  workspaceSwitcher,
}: OrgLearnerHeaderProps & {
  active: OrgNavItem;
  organizationSlug: string;
  showMobileHeader?: boolean;
}) {
  const hrefs = getOrgBottomNavHrefs(organizationSlug);
  const navItems: OrgNavItem[] = ["Home", "Lessons", "Missions", "Store", "Orgs"];

  return (
    <>
      {showMobileHeader ? (
        <OrgLearnerHeader
          balance={balance}
          logoUrl={logoUrl}
          organizationName={organizationName}
          pointsLabel={pointsLabel}
          workspaceSwitcher={workspaceSwitcher}
        />
      ) : null}
      <header className="org-desktop-chrome">
        <Link className="org-desktop-chrome__brand" href="/dashboard">
          <strong>Project Ve</strong>
        </Link>
        <nav aria-label="Organisation learner sections" className="org-desktop-chrome__nav">
          {navItems.map((item) => (
            <Link className={item === active ? "is-active" : undefined} href={hrefs[item]} key={item}>
              {item}
            </Link>
          ))}
        </nav>
        <div className="org-desktop-chrome__context">
          <span className="org-desktop-chrome__org-name">{organizationName}</span>
          {typeof balance === "number" && pointsLabel ? (
            <span className="org-desktop-chrome__points">
              {pointsLabel}: {new Intl.NumberFormat("en-US").format(balance)}
            </span>
          ) : null}
          {workspaceSwitcher}
        </div>
      </header>
    </>
  );
}

export function OrgLearningTopBar({
  backHref,
  title = "Learning",
}: {
  backHref: string;
  title?: string;
}) {
  return (
    <header className="org-learning-topbar">
      <div className="org-learning-topbar__title">
        <Link aria-label="Back" className="org-icon-button" href={backHref}>
          <ArrowLeftIcon className="h-4 w-4" />
        </Link>
        <h1>{title}</h1>
      </div>
      <button aria-label="Search" className="org-icon-button" type="button">
        <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
          <path
            d="m20 20-4.3-4.3m2.3-5.2a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
        </svg>
      </button>
    </header>
  );
}

export function OrgPointsPill({
  balance,
  className,
  label,
  prefix,
}: {
  balance: number;
  className?: string;
  label: string;
  prefix?: string;
}) {
  return (
    <div className={cn("org-points-pill", className)}>
      <strong>{prefix ?? ""}{new Intl.NumberFormat("en-US").format(balance)}</strong>
      <span>{label}</span>
    </div>
  );
}

export function OrgProgressMeter({
  label,
  value,
}: {
  label?: string;
  value: number;
}) {
  const boundedValue = Math.max(0, Math.min(100, value));

  return (
    <div className="org-progress-meter">
      {label ? (
        <div className="org-progress-meter__label">
          <span>{label}</span>
          <strong>{boundedValue}%</strong>
        </div>
      ) : null}
      <div className="org-progress-meter__track">
        <div style={{ width: `${boundedValue}%` }} />
      </div>
    </div>
  );
}

export function OrgActionLink({
  children,
  className,
  href,
}: {
  children: React.ReactNode;
  className?: string;
  href: string;
}) {
  return (
    <Link className={cn("org-action-link", className)} href={href}>
      {children}
      <span aria-hidden="true">-&gt;</span>
    </Link>
  );
}
