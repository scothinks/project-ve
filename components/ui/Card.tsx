import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  variant?: "default" | "lesson" | "mission" | "store" | "quiet";
};

const variants = {
  default: "border border-[var(--ui-border-subtle)] bg-[var(--ui-surface)] shadow-[0_12px_32px_rgba(var(--ui-shadow-rgb),0.12)]",
  lesson: "border border-[color:color-mix(in_srgb,var(--ui-learning)_18%,var(--ui-border-subtle))] bg-[var(--ui-surface)] shadow-[0_10px_28px_rgba(var(--ui-shadow-rgb),0.1)]",
  mission: "border border-[color:color-mix(in_srgb,var(--ui-mission)_20%,var(--ui-border-subtle))] bg-[var(--ui-surface)] shadow-[0_14px_34px_rgba(var(--ui-shadow-rgb),0.14)]",
  store: "border border-[color:color-mix(in_srgb,var(--ui-reward)_24%,var(--ui-border-subtle))] bg-[var(--ui-surface)] shadow-[0_14px_34px_rgba(var(--ui-shadow-rgb),0.14)]",
  quiet: "border border-[var(--ui-border-subtle)] bg-[var(--ui-surface)] shadow-none",
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
