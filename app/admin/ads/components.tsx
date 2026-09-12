import type { ReactNode } from "react";
import {
  AdminCard,
  AdminStatusBadge,
} from "@/components/admin/AdminPrimitives";
import { cn } from "@/lib/utils";
import { setAdEntityStatus } from "./actions";
import type { PlacementRow } from "./types";

export const inputClasses =
  "mt-2 w-full rounded-[14px] border border-[var(--ui-control-border)] bg-[var(--ui-surface)] px-3.5 py-3 text-sm font-semibold outline-none transition placeholder:text-[var(--ui-text-muted)] focus:border-[var(--ui-focus)] focus:ring-4 focus:ring-[var(--ui-focus)]";
export const compactInputClasses =
  "rounded-[12px] border border-[var(--ui-control-border)] bg-[var(--ui-surface)] px-3 py-2 text-xs font-bold outline-none focus:border-[var(--ui-focus)]";
export const secondaryButtonClasses =
  "inline-flex min-h-10 items-center justify-center rounded-[13px] border border-[var(--ui-border)] bg-[var(--ui-surface)] px-4 text-xs font-black text-[var(--ui-text-muted)] transition hover:border-[color:color-mix(in_srgb,var(--ui-action)_26%,var(--ui-border))] hover:text-[var(--ui-action)]";
export const primaryButtonClasses =
  "inline-flex min-h-11 items-center justify-center rounded-[14px] bg-[var(--ui-action)] px-5 text-sm font-black text-[var(--ui-on-action)] shadow-sm transition hover:translate-y-[-1px]";

export function statusTone(status: string) {
  if (["active", "approved", "published"].includes(status)) return "good" as const;
  if (status === "paused" || status === "rejected") return "danger" as const;
  if (status === "submitted") return "store" as const;
  return "warning" as const;
}

export function formatDate(value: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function formatDateTimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

export function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function formatMoneyMinor(value: number) {
  return new Intl.NumberFormat("en", {
    maximumFractionDigits: 0,
  }).format(value);
}

export function listValue(value: string[] | null | undefined) {
  return value?.join(", ") ?? "";
}

export function Field({
  children,
  help,
  label,
  span = false,
}: {
  children: ReactNode;
  help?: string;
  label: string;
  span?: boolean;
}) {
  return (
    <label className={span ? "md:col-span-2" : undefined}>
      <span className="text-xs font-black uppercase tracking-[0.12em] text-[var(--ui-text-muted)]">
        {label}
      </span>
      {children}
      {help ? (
        <span className="mt-1 block text-xs font-semibold leading-5 text-[var(--ui-text-muted)]">
          {help}
        </span>
      ) : null}
    </label>
  );
}

export function SectionTitle({
  children,
  eyebrow,
  subtitle,
}: {
  children: ReactNode;
  eyebrow?: string;
  subtitle?: string;
}) {
  return (
    <div>
      {eyebrow ? (
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--ui-text)]">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="mt-1 text-xl font-black tracking-[-0.02em]">{children}</h2>
      {subtitle ? (
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[var(--ui-text-muted)]">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

export function MetricCard({
  label,
  tone = "default",
  value,
}: {
  label: string;
  tone?: "default" | "good" | "warning" | "danger";
  value: ReactNode;
}) {
  const toneClasses = {
    default: "text-[var(--ui-text)]",
    good: "text-[var(--ui-action)]",
    warning: "text-[var(--ui-warning)]",
    danger: "text-[var(--ui-danger)]",
  };

  return (
    <div className="rounded-[20px] border border-[var(--ui-border-subtle)] bg-[var(--ui-surface)] p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ui-text-muted)]">
        {label}
      </p>
      <p className={cn("mt-3 text-3xl font-black tracking-[-0.04em]", toneClasses[tone])}>
        {value}
      </p>
    </div>
  );
}

export function WorkflowCard({
  children,
  step,
  title,
}: {
  children: ReactNode;
  step: string;
  title: string;
}) {
  return (
    <AdminCard className="overflow-hidden p-0">
      <div className="border-b border-[var(--ui-border-subtle)] bg-[color:color-mix(in_srgb,var(--ui-action-soft)_48%,var(--ui-surface))] px-5 py-4">
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--ui-text)]">
          {step}
        </p>
        <h3 className="mt-1 text-lg font-black">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </AdminCard>
  );
}

export function AdvancedPanel({
  children,
  summary,
}: {
  children: ReactNode;
  summary: string;
}) {
  return (
    <details className="md:col-span-2 rounded-[16px] border border-[var(--ui-border-subtle)] bg-[var(--ui-surface-inset)] p-4">
      <summary className="cursor-pointer text-sm font-black text-[var(--ui-text)]">
        {summary}
      </summary>
      <div className="mt-4 grid gap-4 md:grid-cols-2">{children}</div>
    </details>
  );
}

export function StatusForm({
  entityId,
  entityType,
  returnPath = "/admin/ads/review",
}: {
  entityId: string;
  entityType: string;
  returnPath?: string;
}) {
  return (
    <form action={setAdEntityStatus} className="grid min-w-[260px] gap-2">
      <input name="entityType" type="hidden" value={entityType} />
      <input name="entityId" type="hidden" value={entityId} />
      <input name="returnPath" type="hidden" value={returnPath} />
      <div className="flex gap-2">
        <select className={compactInputClasses} name="status" defaultValue="paused">
          <option value="active">Activate</option>
          <option value="approved">Approve</option>
          <option value="submitted">Mark submitted</option>
          <option value="paused">Pause now</option>
          <option value="archived">Archive</option>
          <option value="rejected">Reject</option>
        </select>
        <button className="rounded-[12px] bg-[var(--ui-action)] px-3 text-xs font-black text-[var(--ui-on-action)]" type="submit">
          Apply
        </button>
      </div>
      <input
        className={compactInputClasses}
        name="reason"
        placeholder="Required context for audit log"
      />
    </form>
  );
}

export function EmptyList({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[16px] border border-dashed border-[var(--ui-border)] bg-[var(--ui-surface-inset)] p-5 text-sm font-semibold text-[var(--ui-text-muted)]">
      {children}
    </div>
  );
}

export function PlacementFallbackPreview({ placement }: { placement: PlacementRow }) {
  return (
    <div className="rounded-[18px] border border-[color:color-mix(in_srgb,var(--ui-action)_16%,var(--ui-border-subtle))] bg-[var(--ui-surface)] p-4 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--ui-text)]">
        Advertise here
      </p>
      <p className="mt-1 text-xs font-bold text-[var(--ui-text-muted)]">
        Project VE Partnerships
      </p>
      <p className="mt-4 text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ui-text-muted)]">
        {placement.house_fallback_eyebrow}
      </p>
      <h4 className="mt-2 text-base font-black leading-6 tracking-[-0.02em]">
        {placement.house_fallback_headline}
      </h4>
      <p className="mt-2 text-xs font-semibold leading-5 text-[var(--ui-text-muted)]">
        {placement.house_fallback_body}
      </p>
      <div className="mt-4 inline-flex min-h-9 items-center rounded-full bg-[var(--ui-action)] px-4 text-xs font-black text-[var(--ui-on-action)]">
        {placement.house_fallback_cta_label}
      </div>
    </div>
  );
}

export { AdminStatusBadge };
