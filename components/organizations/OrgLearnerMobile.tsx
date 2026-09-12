import { PlatformEndorsement } from "@/components/brand/PlatformEndorsement";
import { TenantIdentity } from "@/components/organizations/TenantIdentity";
import Link from "next/link";
import type React from "react";
import { BottomNav } from "@/components/navigation/BottomNav";
import { ArrowRightIcon, StarIcon } from "@/components/organizations/OrgIcons";
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
      ariaLabels={{ Lessons: "Organisation learning navigation" }}
      hrefs={getOrgBottomNavHrefs(organizationSlug)}
    />
  );
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
        <TenantIdentity logoUrl={logoUrl} name={organizationName} detail={title} />
      </div>
      <div className="org-learner-header__endorsement"><PlatformEndorsement /></div>
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
        <div className="org-desktop-chrome__identity">
          <TenantIdentity logoUrl={logoUrl} name={organizationName} />
          <Link className="org-desktop-chrome__endorsement" href="/dashboard">
            <PlatformEndorsement />
          </Link>
        </div>
        <nav aria-label="Organisation learner sections" className="org-desktop-chrome__nav">
          {navItems.map((item) => (
            <Link aria-current={item === active ? "page" : undefined} className={item === active ? "is-active" : undefined} href={hrefs[item]} key={item}>
              {item}
            </Link>
          ))}
        </nav>
        <div className="org-desktop-chrome__context">
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
      <StarIcon className="org-points-pill__icon" />
      <div className="org-points-pill__text">
        <strong>{prefix ?? ""}{new Intl.NumberFormat("en-US").format(balance)}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

export function OrgProgressMeter({
  flush = false,
  label,
  value,
}: {
  flush?: boolean;
  label?: string;
  value: number;
}) {
  const boundedValue = Math.max(0, Math.min(100, value));

  return (
    <div className={cn("org-progress-meter", flush && "org-progress-meter--flush")}>
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
  ariaLabel,
  children,
  className,
  href,
}: {
  ariaLabel?: string;
  children: React.ReactNode;
  className?: string;
  href: string;
}) {
  return (
    <Link aria-label={ariaLabel} className={cn("org-action-link", className)} href={href}>
      {children}
      <ArrowRightIcon className="org-action-link__icon" />
    </Link>
  );
}
