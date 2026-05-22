import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  variant?: "default" | "lesson" | "mission" | "store" | "quiet";
};

const variants = {
  default: "border border-[var(--ve-line-soft)] bg-[var(--ve-card)] shadow-[0_12px_32px_rgba(var(--ve-shadow-rgb),0.12)]",
  lesson: "border border-[color:color-mix(in_srgb,var(--ve-green)_18%,var(--ve-line-soft))] bg-[var(--ve-card)] shadow-[0_10px_28px_rgba(var(--ve-shadow-rgb),0.1)]",
  mission: "border border-[color:color-mix(in_srgb,var(--ve-mission)_20%,var(--ve-line-soft))] bg-[var(--ve-card)] shadow-[0_14px_34px_rgba(255,122,89,0.14)]",
  store: "border border-[color:color-mix(in_srgb,var(--ve-store)_24%,var(--ve-line-soft))] bg-[var(--ve-card)] shadow-[0_14px_34px_rgba(246,196,83,0.14)]",
  quiet: "border border-[var(--ve-line-soft)] bg-[var(--ve-card)] shadow-none",
};

export function Card({ children, className, variant = "default", ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-[24px]",
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
