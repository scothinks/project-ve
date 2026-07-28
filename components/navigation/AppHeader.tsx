import Link from "next/link";
import { ArrowLeftIcon, MenuIcon } from "@/components/ui/Icons";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type AppHeaderProps = {
  title: string;
  backHref?: string;
  showMenu?: boolean;
  className?: string;
  menu?: ReactNode;
};

export function AppHeader({
  title,
  backHref = "/dashboard",
  showMenu = true,
  className,
  menu,
}: AppHeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex h-[104px] items-end justify-between rounded-b-[20px] bg-[var(--ve-card)] px-8 pb-5 shadow-[0_0_20px_rgba(var(--ve-shadow-rgb),0.14)] lg:static lg:h-auto lg:items-center lg:rounded-none lg:bg-transparent lg:px-[clamp(2rem,4vw,4.5rem)] lg:pb-0 lg:pt-8 lg:shadow-none",
        className,
      )}
    >
      <Link
        aria-label="Go back"
        className="grid size-8 place-items-center text-[var(--foreground)] lg:rounded-full lg:border lg:border-[var(--ve-line-soft)] lg:bg-[var(--ve-card)] lg:shadow-[0_10px_24px_rgba(var(--ve-shadow-rgb),0.08)]"
        href={backHref}
      >
        <ArrowLeftIcon className="h-6 w-6" />
      </Link>
      <h1 className="truncate px-3 text-center text-[14px] font-semibold tracking-[-0.01em] text-[var(--foreground)] lg:flex-1 lg:text-left lg:text-[1.85rem] lg:font-black lg:tracking-[-0.04em]">
        {title}
      </h1>
      {menu ?? (showMenu ? (
        <button aria-label="Open menu" className="grid size-8 place-items-center text-[var(--foreground)]">
          <MenuIcon className="h-6 w-6" />
        </button>
      ) : (
        <span className="size-8" />
      ))}
    </header>
  );
}
