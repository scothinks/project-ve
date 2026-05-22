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
] satisfies Array<{ href: string; label: string; icon: ReactNode; activeClassName: string }>;

export function BottomNav({ active }: { active: string }) {
  return (
    <nav className="sticky bottom-0 z-20 mt-8 border-t border-[var(--ve-line-soft)] bg-[var(--ve-card)] px-6 pb-5 pt-3">
      <div className="grid grid-cols-4 gap-2">
        {items.map((item) => {
          const isActive = item.label === active;
          return (
            <Link
              className={cn(
                "flex h-12 flex-col items-center justify-center rounded-[18px] text-[10px] font-semibold text-[var(--ve-muted)]",
                isActive && item.activeClassName,
              )}
              href={item.href}
              key={item.href}
            >
              <span className="grid h-5 place-items-center text-base font-black leading-none">
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
