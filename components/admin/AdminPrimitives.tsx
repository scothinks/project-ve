import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeftIcon, CheckCircleIcon, ChevronRightIcon } from "@/components/ui/Icons";
import { getPaginationWindow } from "@/lib/pagination";
import { cn } from "@/lib/utils";

type AdminButtonTone = "primary" | "secondary" | "danger" | "success" | "neutral";

export function adminButtonClasses(
  tone: AdminButtonTone = "secondary",
  className?: string,
) {
  const base =
    "inline-flex min-h-10 items-center justify-center rounded-[12px] px-4 text-sm font-black transition outline-none focus-visible:ring-4 focus-visible:ring-[var(--ui-focus)] disabled:cursor-not-allowed disabled:opacity-60";

  if (tone === "primary") {
    return cn(base, "bg-[var(--ui-action)] text-[var(--ui-on-action)] hover:bg-[var(--ui-action-hover)] active:bg-[var(--ui-action-pressed)]", className);
  }

  if (tone === "danger") {
    return cn(
      base,
      "border border-[color:color-mix(in_srgb,var(--ui-danger)_22%,var(--ui-border-subtle))] bg-[color:color-mix(in_srgb,var(--ui-danger-bg)_74%,var(--ui-surface))] text-[var(--ui-danger)] hover:brightness-95 focus-visible:ring-[var(--ui-focus)]",
      className,
    );
  }

  if (tone === "success") {
    return cn(
      base,
      "border border-[color:color-mix(in_srgb,var(--ui-success)_24%,var(--ui-border-subtle))] bg-[color:color-mix(in_srgb,var(--ui-success-bg)_82%,var(--ui-surface))] text-[var(--ui-success)] hover:brightness-95",
      className,
    );
  }

  return cn(
    base,
    "border border-[var(--ui-border-subtle)] bg-[var(--ui-surface)] text-[var(--ui-text-muted)] hover:border-[color:color-mix(in_srgb,var(--ui-action)_24%,var(--ui-border-subtle))] hover:text-[var(--ui-action)]",
    className,
  );
}

export function AdminPageHeader({
  backHref,
  backLabel = "Back",
  eyebrow,
  title,
  subtitle,
}: {
  backHref?: string;
  backLabel?: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="mb-6">
      {backHref ? (
        <Link
          className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--ui-border-subtle)] bg-[var(--ui-surface)] px-3 py-2 text-xs font-black text-[var(--ui-text-muted)] shadow-sm transition hover:border-[color:color-mix(in_srgb,var(--ui-action)_24%,var(--ui-border-subtle))] hover:text-[var(--ui-action)]"
          href={backHref}
        >
          <ArrowLeftIcon className="h-4 w-4" />
          {backLabel}
        </Link>
      ) : null}
      {eyebrow ? (
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--ui-text)]">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="mt-2 text-3xl font-black tracking-[-0.01em]">{title}</h1>
      {subtitle ? (
        <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[var(--ui-text-muted)]">
          {subtitle}
        </p>
      ) : null}
    </header>
  );
}

export function AdminCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-[18px] border border-[var(--ui-border-subtle)] bg-[var(--ui-surface)] p-5 shadow-sm", className)}>
      {children}
    </div>
  );
}

export function AdminNoticeBanner({
  children,
  tone = "success",
}: {
  children: ReactNode;
  tone?: "success" | "warning" | "danger" | "info";
}) {
  const tones = {
    success:
      "border-[color:color-mix(in_srgb,var(--ui-success)_22%,var(--ui-border-subtle))] bg-[color:color-mix(in_srgb,var(--ui-success-bg)_78%,var(--ui-surface))] text-[var(--ui-success)]",
    warning:
      "border-[color:color-mix(in_srgb,var(--ui-warning)_24%,var(--ui-border-subtle))] bg-[color:color-mix(in_srgb,var(--ui-warning-bg)_78%,var(--ui-surface))] text-[var(--ui-warning)]",
    danger:
      "border-[color:color-mix(in_srgb,var(--ui-danger)_22%,var(--ui-border-subtle))] bg-[color:color-mix(in_srgb,var(--ui-danger-bg)_74%,var(--ui-surface))] text-[var(--ui-danger)]",
    info:
      "border-[color:color-mix(in_srgb,var(--ui-info)_22%,var(--ui-border-subtle))] bg-[color:color-mix(in_srgb,var(--ui-info-bg)_72%,var(--ui-surface))] text-[var(--ui-info)]",
  };

  return (
    <div
      className={cn(
        "mb-4 rounded-[16px] border px-4 py-3 text-sm font-black shadow-sm",
        tones[tone],
      )}
    >
      {children}
    </div>
  );
}

export function AdminStatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  tone?: "default" | "mission" | "store" | "risk" | "warning";
}) {
  const tones = {
    default: "text-[var(--ui-text)]",
    mission: "text-[var(--ui-mission)]",
    store: "text-[var(--ui-reward)]",
    risk: "text-[var(--ui-danger)]",
    warning: "text-[var(--ui-warning)]",
  };

  return (
    <AdminCard>
      <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ui-text-muted)]">{label}</p>
      <p className={cn("mt-3 text-3xl font-black tabular-nums", tones[tone])}>{value}</p>
    </AdminCard>
  );
}

export function AdminStatusBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "good" | "warning" | "danger" | "store";
}) {
  const tones = {
    neutral: "bg-[var(--ui-surface-muted)] text-[var(--ui-text-muted)]",
    good:
      "bg-[color:color-mix(in_srgb,var(--ui-success-bg)_82%,var(--ui-surface))] text-[var(--ui-success)]",
    warning:
      "bg-[color:color-mix(in_srgb,var(--ui-warning-bg)_82%,var(--ui-surface))] text-[var(--ui-warning)]",
    danger:
      "bg-[color:color-mix(in_srgb,var(--ui-danger-bg)_74%,var(--ui-surface))] text-[var(--ui-danger)]",
    store:
      "bg-[color:color-mix(in_srgb,var(--ui-reward-bg)_82%,var(--ui-surface))] text-[var(--ui-reward)]",
  };

  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center rounded-full px-3 text-xs font-black capitalize",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function AdminTable({
  children,
  columns,
}: {
  children: ReactNode;
  columns: string[];
}) {
  return (
    <div className="overflow-hidden rounded-[18px] border border-[var(--ui-border-subtle)] bg-[var(--ui-surface)]">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-[var(--ui-surface-inset)] text-xs font-black uppercase tracking-[0.12em] text-[var(--ui-text-muted)]">
            <tr>
              {columns.map((column) => (
                <th className="whitespace-nowrap px-4 py-3" key={column}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--ui-border-subtle)]">{children}</tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminMetricCard({
  label,
  value,
  icon,
  trend,
  helpText,
  tone = "default",
  progress,
  href,
  action,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  trend?: { direction: "up" | "down"; label: string };
  helpText?: ReactNode;
  tone?: "default" | "attention" | "warning";
  progress?: number;
  href?: string;
  action?: { label: string; href: string };
}) {
  const toneClasses = {
    default: "border-[var(--ui-border-subtle)] bg-[var(--ui-surface)]",
    attention:
      "border-[color:color-mix(in_srgb,var(--ui-warning)_20%,var(--ui-border-subtle))] bg-[color:color-mix(in_srgb,var(--ui-warning-bg)_18%,var(--ui-surface))]",
    warning:
      "border-[color:color-mix(in_srgb,var(--ui-warning)_20%,var(--ui-border-subtle))] bg-[var(--ui-surface)]",
  };
  const valueTone = {
    default: "text-[var(--ui-text)]",
    attention: "text-[var(--ui-warning)]",
    warning: "text-[var(--ui-text)]",
  };

  const content = (
    <>
      <div className="mb-2 flex items-center gap-2 text-[var(--ui-text-muted)]">
        {icon}
        <span className="text-[11px] font-black uppercase tracking-[0.14em]">{label}</span>
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-end gap-3">
          <span className={cn("text-[28px] font-black leading-none tracking-[-0.02em]", valueTone[tone])}>
            {value}
          </span>
          {trend ? (
            <span
              className={cn(
                "mb-1 flex items-center text-sm font-bold",
                trend.direction === "up" ? "text-[var(--ui-success)]" : "text-[var(--ui-success)]",
              )}
            >
              {trend.direction === "up" ? "↑" : "↓"} {trend.label}
            </span>
          ) : null}
          {helpText && !trend ? (
            <span className="mb-1 text-sm text-[var(--ui-text-muted)]">{helpText}</span>
          ) : null}
        </div>
        {action ? (
          <Link
            className="mb-0.5 shrink-0 rounded-full border border-[color:color-mix(in_srgb,var(--ui-warning)_30%,transparent)] bg-[var(--ui-surface)] px-3 py-1 text-xs font-bold text-[var(--ui-warning)] transition hover:bg-[var(--ui-warning)] hover:text-[var(--ui-on-warning)]"
            href={action.href}
            onClick={(event) => event.stopPropagation()}
          >
            {action.label}
          </Link>
        ) : null}
      </div>
      {typeof progress === "number" ? (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--ui-surface-raised)]">
          <div
            className="h-full rounded-full bg-[var(--ui-warning)]"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      ) : null}
    </>
  );

  const className = cn("flex flex-col gap-1 rounded-[18px] border p-4 shadow-sm", toneClasses[tone]);

  if (href) {
    return (
      <Link className={cn(className, "transition hover:-translate-y-0.5 hover:shadow-md")} href={href}>
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}

export function AdminBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "good" | "warning" | "danger" | "info";
}) {
  const tones = {
    neutral: "bg-[var(--ui-surface-raised)] text-[var(--ui-text-muted)]",
    good: "bg-[color:color-mix(in_srgb,var(--ui-success)_16%,transparent)] text-[var(--ui-success)]",
    warning:
      "bg-[color:color-mix(in_srgb,var(--ui-warning-bg)_60%,transparent)] text-[var(--ui-warning)]",
    danger: "bg-[var(--ui-danger-bg)] text-[var(--ui-danger)]",
    info: "bg-[color:color-mix(in_srgb,var(--ui-info-bg)_30%,transparent)] text-[var(--ui-info)]",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold capitalize",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function AdminAlertCard({
  icon,
  title,
  detail,
  actionLabel,
  actionHref,
  tone = "attention",
}: {
  icon?: ReactNode;
  title: string;
  detail: string;
  actionLabel?: string;
  actionHref?: string;
  tone?: "attention" | "warning";
}) {
  const toneClasses = {
    attention:
      "bg-[color:color-mix(in_srgb,var(--ui-warning-bg)_30%,var(--ui-surface))] border-[color:color-mix(in_srgb,var(--ui-warning)_20%,transparent)] text-[var(--ui-warning)]",
    warning:
      "bg-[color:color-mix(in_srgb,var(--ui-warning-bg)_30%,var(--ui-surface))] border-[color:color-mix(in_srgb,var(--ui-warning)_20%,transparent)] text-[var(--ui-warning)]",
  };
  const linkTone = {
    attention: "text-[var(--ui-warning)]",
    warning: "text-[var(--ui-warning)]",
  };

  return (
    <div className={cn("flex items-start gap-3 rounded-[12px] border p-3", toneClasses[tone])}>
      {icon ? <span className="mt-0.5 shrink-0">{icon}</span> : null}
      <div className="min-w-0">
        <p className="text-sm font-bold">{title}</p>
        <p className="mt-0.5 text-sm opacity-80">{detail}</p>
        {actionLabel && actionHref ? (
          <Link
            className={cn("mt-2 inline-block text-sm font-bold hover:underline", linkTone[tone])}
            href={actionHref}
          >
            {actionLabel}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export function AdminChecklist({
  items,
  progressPercent,
}: {
  items: Array<{ id: string; label: string; complete: boolean; href?: string }>;
  progressPercent: number;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--ui-surface-raised)]">
        <div
          className="h-full rounded-full bg-[var(--ui-action)]"
          style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
        />
      </div>
      <ul className="flex flex-1 flex-col gap-3">
        {items.map((item) => (
          <li className="flex items-center gap-3" key={item.id}>
            <CheckCircleIcon
              className={cn(
                "h-5 w-5 shrink-0",
                item.complete ? "text-[var(--ui-success)]" : "text-[var(--ui-text-muted)]",
              )}
            />
            <span
              className={cn(
                "flex-1 text-sm text-[var(--ui-text)]",
                item.complete ? "text-[var(--ui-text-muted)] line-through opacity-70" : "font-bold",
              )}
            >
              {item.label}
            </span>
            {!item.complete && item.href ? (
              <Link
                className="text-xs font-bold text-[var(--ui-action)] hover:underline"
                href={item.href}
              >
                Fix →
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AdminActivityList({
  items,
}: {
  items: Array<{ id: string; icon?: ReactNode; title: string; detail: ReactNode; timeLabel: string }>;
}) {
  if (items.length === 0) {
    return (
      <p className="py-6 text-center text-sm font-semibold text-[var(--ui-text-muted)]">
        No recent activity yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {items.map((item) => (
        <div className="flex items-start gap-4 rounded-lg p-3 transition hover:bg-[var(--ui-surface-soft)]" key={item.id}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--ui-surface-soft)] text-[var(--ui-text-muted)]">
            {item.icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-sm font-bold text-[var(--ui-text)]">{item.title}</p>
              <span className="shrink-0 text-[10px] font-black uppercase tracking-[0.1em] text-[var(--ui-text-muted)]">
                {item.timeLabel}
              </span>
            </div>
            <p className="text-sm text-[var(--ui-text-muted)]">{item.detail}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function AdminQuickActionButton({
  href,
  icon,
  label,
  emphasis = false,
}: {
  href: string;
  icon?: ReactNode;
  label: string;
  emphasis?: boolean;
}) {
  return (
    <Link
      className={cn(
        "group flex w-full items-center justify-between rounded-[12px] border p-3 transition",
        emphasis
          ? "border-[color:color-mix(in_srgb,var(--ui-action)_20%,transparent)] bg-[color:color-mix(in_srgb,var(--ui-action)_10%,transparent)] hover:bg-[color:color-mix(in_srgb,var(--ui-action)_18%,transparent)]"
          : "border-[var(--ui-border-subtle)] bg-[var(--ui-surface-inset)] hover:bg-[var(--ui-surface-soft)]",
      )}
      href={href}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "transition-transform group-hover:scale-110",
            emphasis ? "text-[var(--ui-action)]" : "text-[var(--ui-text-muted)]",
          )}
        >
          {icon}
        </span>
        <span
          className={cn(
            "font-bold",
            emphasis ? "text-[var(--ui-action)]" : "text-[var(--ui-text)]",
          )}
        >
          {label}
        </span>
      </div>
      <ChevronRightIcon
        className={cn(
          "h-[18px] w-[18px]",
          emphasis ? "text-[var(--ui-action)]/60" : "text-[var(--ui-text-muted)]",
        )}
      />
    </Link>
  );
}

export function EmptyAdminState({ children }: { children: ReactNode }) {
  return (
    <AdminCard className="text-center">
      <p className="text-sm font-bold text-[var(--ui-text-muted)]">{children}</p>
    </AdminCard>
  );
}

export function AdminPagination({
  basePath,
  currentPage,
  totalPages,
  searchParams,
  summary,
}: {
  basePath: string;
  currentPage: number;
  totalPages: number;
  searchParams?: Record<string, string | undefined>;
  summary?: ReactNode;
}) {
  if (totalPages <= 1 && !summary) {
    return null;
  }

  const pageWindow = getPaginationWindow(currentPage, totalPages);

  function buildHref(page: number) {
    const params = new URLSearchParams();
    Object.entries(searchParams ?? {}).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    if (page > 1) {
      params.set("page", String(page));
    } else {
      params.delete("page");
    }
    const query = params.toString();
    return query ? `${basePath}?${query}` : basePath;
  }

  return (
    <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="text-xs font-semibold text-[var(--ui-text-muted)]">{summary ?? "\u00A0"}</div>
      {totalPages > 1 ? (
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          <Link
            className={cn(
              "rounded-[12px] border border-[var(--ui-border)] px-3 py-2 text-xs font-black",
              currentPage === 1 && "pointer-events-none opacity-40",
            )}
            href={buildHref(Math.max(1, currentPage - 1))}
          >
            Prev
          </Link>
          {pageWindow[0] && pageWindow[0] > 1 ? (
            <>
              <Link className="rounded-[12px] border border-[var(--ui-border)] px-3 py-2 text-xs font-black" href={buildHref(1)}>
                1
              </Link>
              {pageWindow[0] > 2 ? <span className="px-1 text-xs font-black text-[var(--ui-text-muted)]">…</span> : null}
            </>
          ) : null}
          {pageWindow.map((page) => (
            <Link
              className={cn(
                "rounded-[12px] border px-3 py-2 text-xs font-black",
                page === currentPage
                  ? "border-[color:color-mix(in_srgb,var(--ui-current-text)_30%,var(--ui-border))] bg-[color:color-mix(in_srgb,var(--ui-current-bg)_82%,var(--ui-surface))] text-[var(--ui-current-text)]"
                  : "border-[var(--ui-border)] text-[var(--ui-text-muted)]",
              )}
              href={buildHref(page)}
              key={page}
            >
              {page}
            </Link>
          ))}
          {pageWindow[pageWindow.length - 1] && pageWindow[pageWindow.length - 1] < totalPages ? (
            <>
              {pageWindow[pageWindow.length - 1] < totalPages - 1 ? (
                <span className="px-1 text-xs font-black text-[var(--ui-text-muted)]">…</span>
              ) : null}
              <Link className="rounded-[12px] border border-[var(--ui-border)] px-3 py-2 text-xs font-black" href={buildHref(totalPages)}>
                {totalPages}
              </Link>
            </>
          ) : null}
          <Link
            className={cn(
              "rounded-[12px] border border-[var(--ui-border)] px-3 py-2 text-xs font-black",
              currentPage === totalPages && "pointer-events-none opacity-40",
            )}
            href={buildHref(Math.min(totalPages, currentPage + 1))}
          >
            Next
          </Link>
        </div>
      ) : null}
    </div>
  );
}
