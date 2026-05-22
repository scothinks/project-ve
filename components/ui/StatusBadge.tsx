import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "trust" | "mission" | "store" | "neutral";

type StatusBadgeProps = {
  children: ReactNode;
  className?: string;
  tone?: Tone;
};

const tones: Record<Tone, string> = {
  trust: "bg-[var(--ve-green-soft)] text-[var(--ve-green)]",
  mission: "bg-[var(--ve-mission-soft)] text-[#c94f2e]",
  store: "bg-[var(--ve-store-soft)] text-[#a66d00]",
  neutral: "bg-[var(--ve-card-muted)] text-[var(--ve-muted-strong)]",
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
