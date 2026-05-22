import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

type Tone = "trust" | "mission" | "store" | "neutral";

type SectionHeaderProps = {
  actionHref?: string;
  actionLabel?: string;
  className?: string;
  eyebrow?: string;
  subtitle?: string;
  title?: string;
  tone?: Tone;
  trailing?: ReactNode;
};

const eyebrowTones: Record<Tone, string> = {
  trust: "text-[var(--ve-green)]",
  mission: "text-[#c94f2e]",
  store: "text-[#a66d00]",
  neutral: "text-[var(--ve-muted)]",
};

export function SectionHeader({
  actionHref,
  actionLabel,
  className,
  eyebrow,
  subtitle,
  title,
  tone = "trust",
  trailing,
}: SectionHeaderProps) {
  return (
    <div className={cn("flex items-end justify-between gap-4", className)}>
      <div>
        {eyebrow ? (
          <p
            className={cn(
              "text-[0.82rem] font-semibold uppercase tracking-[0.18em]",
              eyebrowTones[tone],
            )}
          >
            {eyebrow}
          </p>
        ) : null}
        {title ? (
          <h2 className={cn("font-black leading-tight", eyebrow ? "mt-2 text-[17px]" : "text-[17px]")}>
            {title}
          </h2>
        ) : null}
        {subtitle ? (
          <p className="mt-2 text-[0.92rem] font-medium leading-6 text-[var(--ve-muted)]">
            {subtitle}
          </p>
        ) : null}
      </div>
      {trailing ?? (actionHref && actionLabel ? (
        <Button href={actionHref} className="h-8 shrink-0 px-4 text-xs" variant="ghost">
          {actionLabel}
        </Button>
      ) : null)}
    </div>
  );
}
