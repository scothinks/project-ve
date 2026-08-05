import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

function HomeIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <path
        d="M4 10.8 12 4l8 6.8v8.4a.8.8 0 0 1-.8.8h-4.4v-5.4H9.2V20H4.8a.8.8 0 0 1-.8-.8v-8.4Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="2.2"
      />
    </svg>
  );
}

function LessonIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <path
        d="M5 5.5c0-.8.7-1.5 1.5-1.5H11v15H6.5A1.5 1.5 0 0 1 5 17.5v-12ZM13 4h4.5c.8 0 1.5.7 1.5 1.5v12c0 .8-.7 1.5-1.5 1.5H13V4Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="2.2"
      />
    </svg>
  );
}

function MissionIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <path
        d="M12 21a9 9 0 1 0-9-9 9 9 0 0 0 9 9Z"
        stroke="currentColor"
        strokeWidth="2.2"
      />
      <path
        d="M12 16a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z"
        stroke="currentColor"
        strokeWidth="2.2"
      />
      <path d="M12 9.5V12l1.7 1.2" stroke="currentColor" strokeLinecap="round" strokeWidth="2.2" />
    </svg>
  );
}

function OrgModeIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <path
        d="M5 20V7.8c0-.7.4-1.2 1-1.4l6-2.4 6 2.4c.6.2 1 .8 1 1.4V20"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="2.2"
      />
      <path d="M9 20v-4h6v4M8.5 10h.01M12 10h.01M15.5 10h.01M8.5 13h.01M15.5 13h.01" stroke="currentColor" strokeLinecap="round" strokeWidth="2.2" />
    </svg>
  );
}

const items = [
  {
    href: "/dashboard",
    label: "Home",
    icon: <HomeIcon />,
    activeClassName: "bg-[var(--ve-green-soft)] text-[var(--ve-green)]",
  },
  {
    href: "/courses",
    label: "Lesson",
    icon: <LessonIcon />,
    activeClassName: "bg-[var(--ve-green-soft)] text-[var(--ve-green)]",
  },
  {
    href: "/missions",
    label: "Missions",
    icon: <MissionIcon />,
    activeClassName: "bg-[var(--ve-mission-soft)] text-[#c94f2e]",
  },
  {
    href: "/xp-store",
    label: "Store",
    icon: "XP",
    activeClassName: "bg-[var(--ve-store-soft)] text-[#a66d00]",
  },
  {
    href: "/org",
    label: "Org Mode",
    icon: <OrgModeIcon />,
    activeClassName: "bg-[var(--ve-panel-soft)] text-[var(--foreground)]",
  },
] satisfies Array<{ href: string; label: string; icon: ReactNode; activeClassName: string }>;

export function BottomNav({ active }: { active: string }) {
  return (
    <nav className="sticky bottom-0 z-20 mt-8 border-t border-[var(--ve-line-soft)] bg-[var(--ve-card)] px-3 pb-5 pt-3 sm:px-6 lg:fixed lg:bottom-auto lg:left-[max(1.25rem,calc((100vw-1180px)/2+1.25rem))] lg:top-1/2 lg:mt-0 lg:w-20 lg:-translate-y-1/2 lg:rounded-[28px] lg:border lg:border-[var(--ve-line-soft)] lg:p-2 lg:shadow-[0_18px_50px_rgba(var(--ve-shadow-rgb),0.12)]">
      <div className="mx-auto grid max-w-[25rem] grid-cols-5 gap-1.5 sm:gap-2 md:max-w-[30rem] lg:mx-0 lg:max-w-none lg:grid-cols-1">
        {items.map((item) => {
          const isActive = item.label === active;
          return (
            <Link
              className={cn(
                "flex h-12 flex-col items-center justify-center rounded-[16px] text-center text-[9px] font-semibold leading-3 text-[var(--ve-muted)] sm:text-[10px] lg:h-[4.25rem] lg:rounded-[22px]",
                isActive && item.activeClassName,
              )}
              href={item.href}
              key={item.href}
            >
              <span className="mb-0.5 grid h-5 place-items-center text-base font-black leading-none">
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
