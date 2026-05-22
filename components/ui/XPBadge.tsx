import { cn } from "@/lib/utils";
import { formatXpLabel } from "@/lib/xp-format";

type XPBadgeProps = {
  xp: number;
  className?: string;
};

export function XPBadge({ xp, className }: XPBadgeProps) {
  const label = formatXpLabel(xp);

  return (
    <span
      className={cn(
        "inline-flex h-8 max-w-full min-w-[4.25rem] items-center justify-center whitespace-nowrap rounded-[18px] bg-[var(--ve-green-soft)] px-3 text-center text-[clamp(0.72rem,2.6vw,0.9rem)] font-semibold tracking-[-0.01em] leading-none text-[var(--ve-green)] tabular-nums",
        className,
      )}
      title={label}
    >
      {label}
    </span>
  );
}
