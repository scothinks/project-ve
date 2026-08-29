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
    "inline-flex min-h-10 items-center justify-center rounded-[12px] px-4 text-sm font-black transition outline-none focus-visible:ring-4 focus-visible:ring-[color:color-mix(in_srgb,var(--ve-green)_14%,transparent)] disabled:cursor-not-allowed disabled:opacity-60";

  if (tone === "primary") {
    return cn(base, "bg-[var(--ve-green)] text-white hover:brightness-95", className);
  }

  if (tone === "danger") {
    return cn(
      base,
      "border border-[color:color-mix(in_srgb,var(--ve-danger)_22%,var(--ve-line-soft))] bg-[color:color-mix(in_srgb,var(--ve-danger-soft)_74%,var(--ve-card))] text-[var(--ve-danger)] hover:brightness-95 focus-visible:ring-[color:color-mix(in_srgb,var(--ve-danger)_14%,transparent)]",
      className,
    );
  }

  if (tone === "success") {
    return cn(
      base,
      "border border-[color:color-mix(in_srgb,var(--ve-green)_24%,var(--ve-line-soft))] bg-[color:color-mix(in_srgb,var(--ve-green-soft)_82%,var(--ve-card))] text-[var(--ve-green)] hover:brightness-95",
      className,
    );
  }

  return cn(
    base,
    "border border-[var(--ve-line-soft)] bg-[var(--ve-card)] text-[var(--ve-muted-strong)] hover:border-[color:color-mix(in_srgb,var(--ve-green)_24%,var(--ve-line-soft))] hover:text-[var(--ve-green)]",
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
          className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--ve-line-soft)] bg-[var(--ve-card)] px-3 py-2 text-xs font-black text-[var(--ve-muted-strong)] shadow-sm transition hover:border-[color:color-mix(in_srgb,var(--ve-green)_24%,var(--ve-line-soft))] hover:text-[var(--ve-green)]"
          href={backHref}
        >
          <ArrowLeftIcon className="h-4 w-4" />
          {backLabel}
        </Link>
      ) : null}
      {eyebrow ? (
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--ve-green)]">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="mt-2 text-3xl font-black tracking-[-0.01em]">{title}</h1>
      {subtitle ? (
        <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[var(--ve-muted-strong)]">
          {subtitle}
        </p>
      ) : null}
    </header>
  );
}

export function AdminCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-[18px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] p-5 shadow-sm", className)}>
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
      "border-[color:color-mix(in_srgb,var(--ve-green)_22%,var(--ve-line-soft))] bg-[color:color-mix(in_srgb,var(--ve-green-soft)_78%,var(--ve-card))] text-[var(--ve-green)]",
    warning:
      "border-[color:color-mix(in_srgb,var(--ve-store)_24%,var(--ve-line-soft))] bg-[color:color-mix(in_srgb,var(--ve-store-soft)_78%,var(--ve-card))] text-[color:color-mix(in_srgb,var(--ve-store)_62%,var(--foreground))]",
    danger:
      "border-[color:color-mix(in_srgb,var(--ve-danger)_22%,var(--ve-line-soft))] bg-[color:color-mix(in_srgb,var(--ve-danger-soft)_74%,var(--ve-card))] text-[var(--ve-danger)]",
    info:
      "border-[color:color-mix(in_srgb,var(--ve-violet)_22%,var(--ve-line-soft))] bg-[color:color-mix(in_srgb,var(--ve-violet-soft)_72%,var(--ve-card))] text-[var(--ve-violet)]",
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
    default: "text-[var(--ve-green)]",
    mission: "text-[var(--ve-mission)]",
    store: "text-[color:color-mix(in_srgb,var(--ve-store)_62%,var(--foreground))]",
    risk: "text-[var(--ve-danger)]",
    warning: "text-[color:color-mix(in_srgb,var(--ve-store)_62%,var(--foreground))]",
  };

  return (
    <AdminCard>
      <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">{label}</p>
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
    neutral: "bg-[var(--ve-card-muted)] text-[var(--ve-muted-strong)]",
    good:
      "bg-[color:color-mix(in_srgb,var(--ve-green-soft)_82%,var(--ve-card))] text-[var(--ve-green)]",
    warning:
      "bg-[color:color-mix(in_srgb,var(--ve-store-soft)_82%,var(--ve-card))] text-[color:color-mix(in_srgb,var(--ve-store)_62%,var(--foreground))]",
    danger:
      "bg-[color:color-mix(in_srgb,var(--ve-danger-soft)_74%,var(--ve-card))] text-[var(--ve-danger)]",
    store:
      "bg-[color:color-mix(in_srgb,var(--ve-store-soft)_82%,var(--ve-card))] text-[color:color-mix(in_srgb,var(--ve-store)_62%,var(--foreground))]",
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
    <div className="overflow-hidden rounded-[18px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)]">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-[var(--ve-panel)] text-xs font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]">
            <tr>
              {columns.map((column) => (
                <th className="whitespace-nowrap px-4 py-3" key={column}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--ve-line-soft)]">{children}</tbody>
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
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  trend?: { direction: "up" | "down"; label: string };
  helpText?: ReactNode;
  tone?: "default" | "attention" | "warning";
  progress?: number;
  href?: string;
}) {
  const toneClasses = {
    default: "border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)]",
    attention:
      "border-[color:color-mix(in_srgb,var(--admin-secondary)_20%,var(--admin-border-warm))] bg-[color:color-mix(in_srgb,var(--admin-secondary-fixed)_18%,var(--admin-surface-milk))]",
    warning:
      "border-[color:color-mix(in_srgb,var(--admin-tertiary)_20%,var(--admin-border-warm))] bg-[var(--admin-surface-milk)]",
  };
  const valueTone = {
    default: "text-[var(--admin-ink-charcoal)]",
    attention: "text-[var(--admin-secondary)]",
    warning: "text-[var(--admin-ink-charcoal)]",
  };

  const content = (
    <>
      <div className="mb-2 flex items-center gap-2 text-[var(--admin-on-surface-variant)]">
        {icon}
        <span className="text-[11px] font-black uppercase tracking-[0.14em]">{label}</span>
      </div>
      <div className="flex items-end gap-3">
        <span className={cn("text-[28px] font-black leading-none tracking-[-0.02em]", valueTone[tone])}>
          {value}
        </span>
        {trend ? (
          <span
            className={cn(
              "mb-1 flex items-center text-sm font-bold",
              trend.direction === "up" ? "text-[var(--admin-primary-container)]" : "text-[var(--admin-secondary)]",
            )}
          >
            {trend.direction === "up" ? "↑" : "↓"} {trend.label}
          </span>
        ) : null}
        {helpText && !trend ? (
          <span className="mb-1 text-sm text-[var(--admin-on-surface-variant)]">{helpText}</span>
        ) : null}
      </div>
      {typeof progress === "number" ? (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--admin-surface-container-high)]">
          <div
            className="h-full rounded-full bg-[var(--admin-tertiary)]"
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
      "bg-[color:color-mix(in_srgb,var(--admin-secondary-fixed)_30%,var(--admin-surface-milk))] border-[color:color-mix(in_srgb,var(--admin-secondary)_20%,transparent)] text-[var(--admin-on-secondary-container)]",
    warning:
      "bg-[color:color-mix(in_srgb,var(--admin-tertiary-fixed)_30%,var(--admin-surface-milk))] border-[color:color-mix(in_srgb,var(--admin-tertiary)_20%,transparent)] text-[var(--admin-on-tertiary-fixed-variant)]",
  };
  const linkTone = {
    attention: "text-[var(--admin-secondary)]",
    warning: "text-[var(--admin-tertiary)]",
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
      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--admin-surface-container-high)]">
        <div
          className="h-full rounded-full bg-[var(--admin-primary-container)]"
          style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
        />
      </div>
      <ul className="flex flex-1 flex-col gap-3">
        {items.map((item) => (
          <li className="flex items-center gap-3" key={item.id}>
            <CheckCircleIcon
              className={cn(
                "h-5 w-5 shrink-0",
                item.complete ? "text-[var(--admin-primary-container)]" : "text-[var(--admin-outline)]",
              )}
            />
            <span
              className={cn(
                "flex-1 text-sm text-[var(--admin-on-surface)]",
                item.complete ? "text-[var(--admin-on-surface-variant)] line-through opacity-70" : "font-bold",
              )}
            >
              {item.label}
            </span>
            {!item.complete && item.href ? (
              <Link
                className="text-xs font-bold text-[var(--admin-primary)] hover:underline"
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
      <p className="py-6 text-center text-sm font-semibold text-[var(--admin-on-surface-variant)]">
        No recent activity yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {items.map((item) => (
        <div className="flex items-start gap-4 rounded-lg p-3 transition hover:bg-[var(--admin-surface-container-low)]" key={item.id}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--admin-surface-container-low)] text-[var(--admin-on-surface-variant)]">
            {item.icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-sm font-bold text-[var(--admin-ink-charcoal)]">{item.title}</p>
              <span className="shrink-0 text-[10px] font-black uppercase tracking-[0.1em] text-[var(--admin-outline)]">
                {item.timeLabel}
              </span>
            </div>
            <p className="text-sm text-[var(--admin-on-surface-variant)]">{item.detail}</p>
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
          ? "border-[color:color-mix(in_srgb,var(--admin-primary-container)_20%,transparent)] bg-[color:color-mix(in_srgb,var(--admin-primary-container)_10%,transparent)] hover:bg-[color:color-mix(in_srgb,var(--admin-primary-container)_18%,transparent)]"
          : "border-[var(--admin-border-warm)] bg-[var(--admin-surface)] hover:bg-[var(--admin-surface-container-low)]",
      )}
      href={href}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "transition-transform group-hover:scale-110",
            emphasis ? "text-[var(--admin-primary-container)]" : "text-[var(--admin-on-surface-variant)]",
          )}
        >
          {icon}
        </span>
        <span
          className={cn(
            "font-bold",
            emphasis ? "text-[var(--admin-primary-container)]" : "text-[var(--admin-on-surface)]",
          )}
        >
          {label}
        </span>
      </div>
      <ChevronRightIcon
        className={cn(
          "h-[18px] w-[18px]",
          emphasis ? "text-[var(--admin-primary-container)]/60" : "text-[var(--admin-outline)]",
        )}
      />
    </Link>
  );
}

export function EmptyAdminState({ children }: { children: ReactNode }) {
  return (
    <AdminCard className="text-center">
      <p className="text-sm font-bold text-[var(--ve-muted)]">{children}</p>
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
      <div className="text-xs font-semibold text-[var(--ve-muted)]">{summary ?? "\u00A0"}</div>
      {totalPages > 1 ? (
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          <Link
            className={cn(
              "rounded-[12px] border border-[var(--ve-line)] px-3 py-2 text-xs font-black",
              currentPage === 1 && "pointer-events-none opacity-40",
            )}
            href={buildHref(Math.max(1, currentPage - 1))}
          >
            Prev
          </Link>
          {pageWindow[0] && pageWindow[0] > 1 ? (
            <>
              <Link className="rounded-[12px] border border-[var(--ve-line)] px-3 py-2 text-xs font-black" href={buildHref(1)}>
                1
              </Link>
              {pageWindow[0] > 2 ? <span className="px-1 text-xs font-black text-[var(--ve-muted)]">…</span> : null}
            </>
          ) : null}
          {pageWindow.map((page) => (
            <Link
              className={cn(
                "rounded-[12px] border px-3 py-2 text-xs font-black",
                page === currentPage
                  ? "border-[color:color-mix(in_srgb,var(--ve-green)_30%,var(--ve-line))] bg-[color:color-mix(in_srgb,var(--ve-green-soft)_82%,var(--ve-card))] text-[var(--ve-green)]"
                  : "border-[var(--ve-line)] text-[var(--ve-muted-strong)]",
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
                <span className="px-1 text-xs font-black text-[var(--ve-muted)]">…</span>
              ) : null}
              <Link className="rounded-[12px] border border-[var(--ve-line)] px-3 py-2 text-xs font-black" href={buildHref(totalPages)}>
                {totalPages}
              </Link>
            </>
          ) : null}
          <Link
            className={cn(
              "rounded-[12px] border border-[var(--ve-line)] px-3 py-2 text-xs font-black",
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
