import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "soft" | "outline" | "ghost";

const variants: Record<Variant, string> = {
  primary: "bg-[var(--ui-action)] text-[var(--ui-on-action)] shadow-[0_12px_24px_rgba(var(--ui-shadow-rgb),0.22)] hover:bg-[var(--ui-action-hover)] active:bg-[var(--ui-action-pressed)]",
  soft: "bg-[var(--ui-action-soft)] text-[var(--ui-on-action-soft)]",
  outline: "border border-[var(--ui-border)] bg-[var(--ui-surface)] text-[var(--ui-text-muted)]",
  ghost: "bg-transparent text-[var(--ui-action)]",
};

const base =
  "inline-flex h-11 min-w-0 items-center justify-center rounded-[30px] px-5 text-[0.95rem] font-semibold tracking-[-0.01em] transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-60";

type CommonProps = {
  children: ReactNode;
  className?: string;
  variant?: Variant;
};

type ButtonAsButton = CommonProps &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    href?: never;
  };

type ButtonAsLink = CommonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
    href: string;
  };

export function Button({
  children,
  className,
  variant = "primary",
  href,
  ...props
}: ButtonAsButton | ButtonAsLink) {
  const classes = cn(base, variants[variant], className);

  if (href) {
    const linkProps = props as AnchorHTMLAttributes<HTMLAnchorElement>;
    return (
      <Link className={classes} href={href} {...linkProps}>
        {children}
      </Link>
    );
  }

  const buttonProps = props as ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button className={classes} {...buttonProps}>
      {children}
    </button>
  );
}
