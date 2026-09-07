import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { PLATFORM_CATALOG_WORKSPACE_ID } from "@/features/admin/shared/workspace";
import { resolveOrganizationEntitlements } from "@/features/organizations/application/entitlements";
import { getOrganizationAiUsageSummary } from "@/features/ai-generation/application/organization-ai-metering";

function formatUnits(value: number) {
  return new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 }).format(value);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

function formatRelativeTime(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) return "Just now";
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

export default async function AiCreditsPage() {
  const { supabase, workspace } = await requireAdmin();
  const isOrgWorkspace = workspace.type === "organization" && workspace.id !== PLATFORM_CATALOG_WORKSPACE_ID;

  const entitlements = isOrgWorkspace
    ? (await resolveOrganizationEntitlements(supabase, workspace.id)).entitlements
    : null;
  const summary = entitlements
    ? await getOrganizationAiUsageSummary(supabase, workspace.id, entitlements)
    : null;

  const usedPercent = summary && summary.allocatedUnits > 0
    ? Math.min(100, Math.round((summary.usedUnits / summary.allocatedUnits) * 100))
    : 0;
  const isNearLimit = usedPercent >= 80;

  return (
    <div className="-mx-5 md:-mx-8">
      <div className="border-b border-[var(--admin-border-warm)] px-5 py-6 md:px-10">
        <Link
          className="inline-flex items-center gap-2 text-sm font-bold text-[var(--admin-on-surface-variant)]"
          href="/admin/courses"
        >
          <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" viewBox="0 0 24 24">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back
        </Link>
      </div>

      <div className="flex justify-center px-6 py-12 md:py-24">
        <div className="flex w-full max-w-[820px] flex-col">
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--admin-accent-violet,#8d68f2)]">
            {isOrgWorkspace ? "This organisation" : "Platform catalogue"}
          </p>
          <h1 className="mt-2.5 text-[32px] font-black leading-[1.1] tracking-[-0.01em] text-[var(--admin-brand-hero)]">
            AI credits &amp; usage
          </h1>
          <p className="mt-2.5 max-w-[560px] text-sm font-medium leading-[1.6] text-[var(--admin-on-surface-variant)]">
            What your organisation has used this cycle, and what&apos;s still available.
          </p>

          {!summary ? (
            <div className="mt-8 rounded-[20px] border border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] px-6 py-6">
              <p className="text-sm font-semibold leading-6 text-[var(--admin-on-surface-variant)]">
                {isOrgWorkspace
                  ? "AI authoring is unavailable."
                  : "0 credits"}
              </p>
            </div>
          ) : (
            <>
              <div className="mt-8 rounded-[20px] border border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <p className="text-xl font-black text-[var(--admin-on-surface)]">
                    {formatUnits(summary.usedUnits)} of {formatUnits(summary.allocatedUnits)} credits used
                  </p>
                  <span className="text-xs font-bold text-[var(--admin-on-surface-variant)]">
                    Resets {formatDate(summary.resetsAt)}
                  </span>
                </div>
                <div className="mt-3.5 h-2.5 overflow-hidden rounded-full bg-[var(--admin-surface-container-low)]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      background: isNearLimit ? "var(--admin-secondary)" : "var(--admin-primary)",
                      width: `${usedPercent}%`,
                    }}
                  />
                </div>
                <p
                  className="mt-2.5 text-xs font-bold"
                  style={{ color: isNearLimit ? "var(--admin-secondary)" : "var(--admin-on-surface-variant)" }}
                >
                  {isNearLimit
                    ? "Approaching this cycle's limit."
                    : `${formatUnits(Math.max(0, summary.allocatedUnits - summary.usedUnits))} credits remaining.`}
                </p>
              </div>

              <div className="mt-6 grid gap-3.5 sm:grid-cols-3">
                <div className="rounded-[16px] border border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] p-4">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
                    Monthly allocation
                  </p>
                  <p className="mt-1.5 text-xl font-black text-[var(--admin-on-surface)]">{formatUnits(summary.monthlyAllocation)}</p>
                </div>
                <div className="rounded-[16px] border border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] p-4">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
                    Temporary allocation
                  </p>
                  <p className="mt-1.5 text-xl font-black text-[var(--admin-on-surface)]">{formatUnits(summary.temporaryAllocation)}</p>
                </div>
                <div className="rounded-[16px] border border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] p-4">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
                    Top-up balance
                  </p>
                  <p className="mt-1.5 text-xl font-black text-[var(--admin-on-surface)]">{formatUnits(summary.topUpAllocation)}</p>
                </div>
              </div>

              <p className="mb-3 mt-8 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--admin-on-surface-variant)]">
                Recent AI activity
              </p>
              {summary.recentActivity.length === 0 ? (
                <p className="rounded-[16px] border border-dashed border-[var(--admin-border-warm)] px-4 py-6 text-center text-sm font-semibold text-[var(--admin-on-surface-variant)]">
                  No AI activity yet this cycle.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {summary.recentActivity.map((item) => (
                    <div
                      className="flex items-center gap-3.5 rounded-[14px] border border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] px-4 py-3"
                      key={item.id}
                    >
                      <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-[var(--admin-on-surface)]">
                        {item.operationType.replaceAll("_", " ")}
                      </span>
                      <span className="w-[90px] shrink-0 text-xs font-semibold text-[var(--admin-on-surface-variant)]">
                        {formatUnits(item.status === "charged" ? item.finalChargedUnits ?? item.reservedUnits : item.reservedUnits)} credits
                      </span>
                      <span className="shrink-0 text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--admin-on-surface-variant)]">
                        {item.status}
                      </span>
                      <span className="w-[70px] shrink-0 text-right text-[11px] font-semibold text-[var(--admin-outline)]">
                        {formatRelativeTime(item.createdAt)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
