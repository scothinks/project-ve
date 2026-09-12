import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "trust" | "mission" | "store" | "neutral";

type StatusBadgeProps = {
  children: ReactNode;
  className?: string;
  tone?: Tone;
};

const tones: Record<Tone, string> = {
  trust: "bg-[var(--ui-success-bg)] text-[var(--ui-success)]",
  mission: "bg-[var(--ui-mission-bg)] text-[var(--ui-danger)]",
  store: "bg-[color:color-mix(in_srgb,var(--ui-reward-bg)_84%,var(--ui-surface))] text-[var(--ui-reward)]",
  neutral: "bg-[var(--ui-surface-muted)] text-[var(--ui-text-muted)]",
};

export function StatusBadge({ children, className, tone = "trust" }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex min-h-8 max-w-full items-center justify-center whitespace-nowrap rounded-[18px] px-4 text-center text-[0.82rem] font-semibold tracking-[-0.01em] leading-none tabular-nums",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
