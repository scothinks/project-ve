import Link from "next/link";
import { AdminCard } from "@/components/admin/AdminPrimitives";
import {
  availabilityLabel,
  dateLabel,
} from "@/features/reward-economy/vocabulary";
import type { getEconomyStock } from "@/features/reward-economy/stock";
export function StockContext({
  stock,
  rewardId,
  campaignId,
}: {
  stock: Awaited<ReturnType<typeof getEconomyStock>>;
  rewardId?: string;
  campaignId?: string;
}) {
  const query = new URLSearchParams({
    ...(rewardId ? { rewardId } : {}),
    ...(campaignId ? { campaignId } : {}),
  }).toString();
  return (
    <section className="mt-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold">Stock & movements</h2>
        <div className="flex gap-4 text-sm font-semibold">
          <Link href={`/admin/inventory/new?${query}`}>Add stock →</Link>
          <Link href={`/admin/inventory/reallocate?${query}`}>
            Move stock →
          </Link>
        </div>
      </div>
      <p className="text-sm text-[var(--ui-text-muted)]">
        Latest 25 quantity allocations, imported batches and movements. Imported
        row counts describe uploads, not remaining code stock.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        <AdminCard>
          <h3 className="mb-3 font-semibold">Quantity allocations</h3>
          {!stock.allocations.length ? (
            <p className="text-sm text-[var(--ui-text-muted)]">
              No quantity allocations.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--ui-border-subtle)]">
              {stock.allocations.map((row) => (
                <li className="py-3 text-sm" key={row.id}>
                  <p className="font-semibold">
                    {row.batch_label || row.rewardTitle}
                  </p>
                  <p>
                    {row.quantity_available} available of {row.quantity_total} ·{" "}
                    {row.allocation_type.replaceAll("_", " ")}
                  </p>
                  <p className="text-[var(--ui-text-muted)]">
                    {availabilityLabel(row.available_from, row.expires_at)}
                  </p>
                  {row.partner_reference ? (
                    <p>{row.partner_reference}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </AdminCard>
        <AdminCard>
          <h3 className="mb-3 font-semibold">Uploaded batches</h3>
          {!stock.batches.length ? (
            <p className="text-sm text-[var(--ui-text-muted)]">
              No uploaded batches.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--ui-border-subtle)]">
              {stock.batches.map((row) => (
                <li className="py-3 text-sm" key={row.id}>
                  <p className="font-semibold">
                    {row.batch_label || row.rewardTitle}
                  </p>
                  <p>
                    {row.imported_rows} rows imported · {row.status}
                  </p>
                  <p className="text-[var(--ui-text-muted)]">
                    {availabilityLabel(row.available_from, row.expires_at)}
                  </p>
                  {row.partner_reference ? (
                    <p>{row.partner_reference}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </AdminCard>
      </div>
      <AdminCard>
        <h3 className="mb-3 font-semibold">Movement ledger</h3>
        {!stock.movements.length ? (
          <p className="text-sm text-[var(--ui-text-muted)]">
            No movements recorded.
          </p>
        ) : (
          <ol className="divide-y divide-[var(--ui-border-subtle)]">
            {stock.movements.map((row) => (
              <li
                className="flex flex-wrap justify-between gap-3 py-3 text-sm"
                key={row.id}
              >
                <div>
                  <p className="font-semibold">
                    {row.rewardTitle} · {row.quantity} units
                  </p>
                  <p>{row.context}</p>
                  <p className="text-[var(--ui-text-muted)]">{row.reason}</p>
                </div>
                <time dateTime={row.createdAt}>{dateLabel(row.createdAt)}</time>
              </li>
            ))}
          </ol>
        )}
      </AdminCard>
    </section>
  );
}
