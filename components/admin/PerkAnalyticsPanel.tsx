import type { AdminPerkDistributionRow, AdminPerkTrendPoint } from "@/lib/admin";
import { AdminCard } from "@/components/admin/AdminPrimitives";

function maxDraws(points: AdminPerkTrendPoint[]) {
  return Math.max(1, ...points.map((point) => point.draws));
}

export function PerkAnalyticsPanel({
  trend,
  distribution,
}: {
  trend: AdminPerkTrendPoint[];
  distribution: AdminPerkDistributionRow[];
}) {
  const trendMax = maxDraws(trend);

  return (
    <section className="mt-6 grid gap-4 xl:grid-cols-2">
      <AdminCard>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ui-text-muted)]">Draw trend</p>
        <h2 className="mt-2 text-xl font-black">Last 14 days</h2>
        {trend.length === 0 ? (
          <p className="mt-3 text-sm font-semibold text-[var(--ui-text-muted)]">No draw activity yet.</p>
        ) : (
          <div className="mt-5">
            <div className="flex h-48 items-end gap-2">
              {trend.map((point) => {
                const height = `${Math.max(10, Math.round((point.draws / trendMax) * 100))}%`;
                const fallbackHeight =
                  point.draws > 0
                    ? `${Math.max(0, Math.round((point.fallbackDraws / point.draws) * 100))}%`
                    : "0%";

                return (
                  <div className="flex min-w-0 flex-1 flex-col items-center gap-2" key={point.date}>
                    <div className="relative flex h-full w-full items-end rounded-[14px] bg-[var(--ui-surface-inset)] px-1 pb-1">
                      <div className="relative w-full rounded-[10px] bg-[color:color-mix(in_srgb,var(--ui-info-bg)_82%,var(--ui-surface))]" style={{ height }}>
                        {point.fallbackDraws > 0 ? (
                          <div
                            className="absolute bottom-0 left-0 w-full rounded-b-[10px] bg-[color:color-mix(in_srgb,var(--ui-reward)_54%,var(--ui-surface))]"
                            style={{ height: fallbackHeight }}
                          />
                        ) : null}
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-[11px] font-black tabular-nums text-[var(--ui-text)]">{point.draws}</p>
                      <p className="text-[10px] font-semibold text-[var(--ui-text-muted)]">{point.date.slice(5)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold text-[var(--ui-text-muted)]">
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-[color:color-mix(in_srgb,var(--ui-info-bg)_82%,var(--ui-surface))]" />
                Total draws
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-[color:color-mix(in_srgb,var(--ui-reward)_54%,var(--ui-surface))]" />
                Fallback draws
              </span>
            </div>
          </div>
        )}
      </AdminCard>

      <AdminCard>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ui-text-muted)]">Distribution</p>
        <h2 className="mt-2 text-xl font-black">What learners are winning</h2>
        {distribution.length === 0 ? (
          <p className="mt-3 text-sm font-semibold text-[var(--ui-text-muted)]">No awarded prizes yet.</p>
        ) : (
          <div className="mt-5 space-y-3">
            {distribution.map((row) => (
              <div key={row.key}>
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-black">{row.label}</p>
                  <p className="whitespace-nowrap text-xs font-black tabular-nums text-[var(--ui-text-muted)]">
                    {row.draws} · {Math.round(row.share * 100)}%
                  </p>
                </div>
                <div className="mt-2 h-3 rounded-full bg-[var(--ui-surface-inset)]">
                  <div
                    className="h-3 rounded-full bg-[var(--ui-info)]"
                    style={{ width: `${Math.max(6, Math.round(row.share * 100))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </AdminCard>
    </section>
  );
}
