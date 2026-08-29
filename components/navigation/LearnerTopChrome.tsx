import Link from "next/link";
import { Avatar } from "@/components/profile/Avatar";
import { BellIcon } from "@/components/ui/Icons";
import type { ReactNode } from "react";

type LearnerTopChromeProps = {
  active: "Home" | "Lessons" | "Missions" | "Store" | "Orgs";
  avatarUrl?: string | null;
  displayName: string;
  email?: string | null;
  leading?: ReactNode;
  notificationControl?: ReactNode;
  unreadNotificationCount?: number;
  workspaceSwitcher?: ReactNode;
};

const navItems = [
  ["Home", "/dashboard"],
  ["Lessons", "/courses"],
  ["Missions", "/missions"],
  ["Store", "/xp-store"],
  ["Orgs", "/org"],
] as const;

export function LearnerTopChrome({
  active,
  avatarUrl,
  displayName,
  email,
  leading,
  notificationControl,
  unreadNotificationCount = 0,
  workspaceSwitcher,
}: LearnerTopChromeProps) {
  return (
    <header className="learner-topbar">
      {leading ?? (
        <Link aria-label="Open profile" className="learner-topbar__avatar" href="/profile">
          <Avatar
            avatarUrl={avatarUrl}
            className="size-6 text-[10px] md:size-7"
            email={email}
            name={displayName}
          />
        </Link>
      )}
      <Link className="learner-topbar__brand" href="/dashboard">
        Project Ve
      </Link>
      <div aria-label="Learner sections" className="learner-topbar__nav">
        {navItems.map(([label, href]) => (
          <Link className={label === active ? "is-active" : undefined} href={href} key={href}>
            {label}
          </Link>
        ))}
      </div>
      {workspaceSwitcher ? (
        <div className="learner-topbar__workspace">{workspaceSwitcher}</div>
      ) : null}
      {notificationControl ?? (
        <LearnerNotificationControl unreadNotificationCount={unreadNotificationCount} />
      )}
      <Link className="learner-topbar__profile" href="/profile">
        <Avatar avatarUrl={avatarUrl} className="size-7 text-[10px]" email={email} name={displayName} />
      </Link>
    </header>
  );
}

export function LearnerNotificationControl({
  unreadNotificationCount = 0,
}: {
  unreadNotificationCount?: number;
}) {
  return (
    <Link
      aria-label={
        unreadNotificationCount > 0
          ? `Open notifications with ${unreadNotificationCount} unread`
          : "Open notifications"
      }
      className="learner-topbar__icon"
      href="/notifications"
    >
      {unreadNotificationCount > 0 ? <span className="learner-topbar__dot" /> : null}
      <BellIcon className="h-[17px] w-[17px]" />
    </Link>
  );
}
