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
    outer: "border-[var(--ui-action)] bg-[var(--ui-action)]",
    eyebrow: "text-[var(--ui-on-action)]",
    title: "text-[var(--ui-on-action)]",
    subtitle: "text-[var(--ui-on-action)]",
  },
  lesson: {
    outer: "border-[color:color-mix(in_srgb,var(--ui-learning)_18%,var(--ui-border-subtle))] bg-[color:color-mix(in_srgb,var(--ui-learning-bg)_78%,var(--ui-surface))]",
    eyebrow: "text-[var(--ui-learning)]",
    title: "text-[var(--ui-text)]",
    subtitle: "text-[var(--ui-text-muted)]",
  },
  mission: {
    outer: "border-[color:color-mix(in_srgb,var(--ui-mission)_20%,var(--ui-border-subtle))] bg-[var(--ui-mission-bg)]",
    eyebrow: "text-[var(--ui-mission)]",
    title: "text-[var(--ui-text)]",
    subtitle: "text-[var(--ui-text-muted)]",
  },
  store: {
    outer: "border-[color:color-mix(in_srgb,var(--ui-reward)_24%,var(--ui-border-subtle))] bg-[var(--ui-reward-bg)]",
    eyebrow: "text-[var(--ui-reward)]",
    title: "text-[var(--ui-text)]",
    subtitle: "text-[var(--ui-text-muted)]",
  },
  profile: {
    outer: "border-[var(--ui-border-subtle)] bg-[var(--ui-surface-inset)]",
    eyebrow: "text-[var(--ui-text-muted)]",
    title: "text-[var(--ui-text)]",
    subtitle: "text-[var(--ui-text-muted)]",
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
            <div className="rounded-[16px] bg-[var(--ui-surface)] px-2 py-3" key={metric.label}>
              <p className={cn("text-lg font-black text-[var(--ui-text)]", metric.valueClassName)}>
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
