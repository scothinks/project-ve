import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "home" | "lesson" | "mission" | "store" | "profile";

type Metric = {
  label: string;
  valueClassName?: string;
  value: string;
};

type ExperienceHeaderProps = {
  badge?: ReactNode;
  className?: string;
  eyebrow: string;
  metrics?: Metric[];
  subtitle: string;
  title: string;
  tone?: Tone;
};

const toneStyles: Record<Tone, { outer: string; eyebrow: string; title: string; subtitle: string }> = {
  home: {
    outer: "border-[#d6ece2] bg-[#123c35]",
    eyebrow: "text-[#9ce0bd]",
    title: "text-[#fff8df]",
    subtitle: "text-[#d9efe5]",
  },
  lesson: {
    outer: "border-[color:color-mix(in_srgb,var(--ve-green)_18%,var(--ve-line-soft))] bg-[color:color-mix(in_srgb,var(--ve-green-soft)_78%,var(--ve-card))]",
    eyebrow: "text-[var(--ve-green)]",
    title: "text-[var(--foreground)]",
    subtitle: "text-[var(--ve-muted-strong)]",
  },
  mission: {
    outer: "border-[color:color-mix(in_srgb,var(--ve-mission)_20%,var(--ve-line-soft))] bg-[var(--ve-mission-soft)]",
    eyebrow: "text-[#c94f2e]",
    title: "text-[var(--foreground)]",
    subtitle: "text-[var(--ve-muted-strong)]",
  },
  store: {
    outer: "border-[color:color-mix(in_srgb,var(--ve-store)_24%,var(--ve-line-soft))] bg-[var(--ve-store-soft)]",
    eyebrow: "text-[#a66d00]",
    title: "text-[var(--foreground)]",
    subtitle: "text-[var(--ve-muted-strong)]",
  },
  profile: {
    outer: "border-[var(--ve-line-soft)] bg-[var(--ve-panel)]",
    eyebrow: "text-[var(--ve-muted-strong)]",
    title: "text-[var(--foreground)]",
    subtitle: "text-[var(--ve-muted-strong)]",
  },
};

export function ExperienceHeader({
  badge,
  className,
  eyebrow,
  metrics,
  subtitle,
  title,
  tone = "lesson",
}: ExperienceHeaderProps) {
  const styles = toneStyles[tone];

  return (
    <div className={cn("-mx-6 border-y px-6 py-7", styles.outer, className)}>
      <div className="flex items-start justify-between gap-5">
        <div className="min-w-0">
          <p className={cn("text-xs font-black uppercase tracking-[0.16em]", styles.eyebrow)}>
            {eyebrow}
          </p>
          <h1 className={cn("mt-2 text-3xl font-black leading-9", styles.title)}>
            {title}
          </h1>
          <p className={cn("mt-3 text-sm font-semibold leading-6", styles.subtitle)}>
            {subtitle}
          </p>
        </div>
        {badge ? <div className="shrink-0">{badge}</div> : null}
      </div>

      {metrics?.length ? (
        <div className="mt-5 grid grid-cols-3 gap-2 text-center">
          {metrics.map((metric) => (
            <div className="rounded-[16px] bg-[var(--ve-card)] px-2 py-3" key={metric.label}>
              <p className={cn("text-lg font-black text-[var(--foreground)]", metric.valueClassName)}>
                {metric.value}
              </p>
              <p className={cn("mt-1 text-[10px] font-bold", styles.subtitle)}>
                {metric.label}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
