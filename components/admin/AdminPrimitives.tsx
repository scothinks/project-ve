import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeftIcon } from "@/components/ui/Icons";
import { getPaginationWindow } from "@/lib/pagination";
import { cn } from "@/lib/utils";

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
          className="mb-4 inline-flex items-center gap-2 rounded-full bg-[var(--ve-card)] px-3 py-2 text-xs font-black text-[#4f4f4f] shadow-sm ring-1 ring-[#e6e1d8] transition hover:text-[#087f5b]"
          href={backHref}
        >
          <ArrowLeftIcon className="h-4 w-4" />
          {backLabel}
        </Link>
      ) : null}
      {eyebrow ? (
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#087f5b]">
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
    success: "border-[#d6efe4] bg-[#edf8f1] text-[#087f5b]",
    warning: "border-[#f5e6a8] bg-[#fff8df] text-[#a66d00]",
    danger: "border-[#f1d2d2] bg-[#fff0f0] text-[#c00000]",
    info: "border-[#d8d8ef] bg-[#f2f1fb] text-[#5a4fcf]",
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
    default: "text-[#087f5b]",
    mission: "text-[#c94f2e]",
    store: "text-[#a66d00]",
    risk: "text-[#c00000]",
    warning: "text-[#a66d00]",
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
    neutral: "bg-[var(--ve-card-muted)] text-[#5f5f5a]",
    good: "bg-[#e4f4ed] text-[#087f5b]",
    warning: "bg-[#fff8df] text-[#a66d00]",
    danger: "bg-[#fff0f0] text-[#c00000]",
    store: "bg-[#fff8df] text-[#a66d00]",
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
          <tbody className="divide-y divide-[#efebe3]">{children}</tbody>
        </table>
      </div>
    </div>
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
                  ? "border-[#087f5b] bg-[#e4f4ed] text-[#087f5b]"
                  : "border-[var(--ve-line)] text-[#5f5f5a]",
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
