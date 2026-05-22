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
        "sticky top-0 z-20 flex h-[104px] items-end justify-between rounded-b-[20px] bg-[var(--ve-card)] px-8 pb-5 shadow-[0_0_20px_rgba(var(--ve-shadow-rgb),0.14)]",
        className,
      )}
    >
      <Link
        aria-label="Go back"
        className="grid size-8 place-items-center text-[var(--foreground)]"
        href={backHref}
      >
        <ArrowLeftIcon className="h-6 w-6" />
      </Link>
      <h1 className="truncate px-3 text-center text-[14px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">
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
