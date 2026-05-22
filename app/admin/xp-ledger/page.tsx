import Link from "next/link";
import {
  AdminCard,
  AdminPagination,
  AdminPageHeader,
  AdminStatusBadge,
  AdminTable,
  EmptyAdminState,
} from "@/components/admin/AdminPrimitives";
import { getAdminXpLedger, requireAdmin } from "@/lib/admin";
import { paginateItems, parsePageParam } from "@/lib/pagination";
import { formatRewardDate } from "@/lib/rewards";
import { formatXpLabel } from "@/lib/xp-format";

type AdminXpLedgerPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function valueOf(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

const sourceOptions = [
  { value: "", label: "All sources" },
  { value: "quiz_question", label: "Quiz question" },
  { value: "mission", label: "Mission" },
  { value: "reward_redemption", label: "Reward redemption" },
  { value: "adjustment", label: "Adjustment" },
] as const;

const directionOptions = [
  { value: "", label: "All directions" },
  { value: "earn", label: "Earn" },
  { value: "spend", label: "Spend" },
] as const;

function fieldClasses() {
  return "mt-2 w-full rounded-[14px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-4 py-3 text-sm font-bold outline-none transition focus:border-[#087f5b] focus:ring-4 focus:ring-[#087f5b]/10";
}

function labelClasses() {
  return "text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]";
}

export default async function AdminXpLedgerPage({
  searchParams,
}: AdminXpLedgerPageProps) {
  const [{ supabase }, resolvedParams] = await Promise.all([
    requireAdmin(),
    (searchParams ?? Promise.resolve({})) as Promise<Record<string, string | string[] | undefined>>,
  ]);
  const userQuery = valueOf(resolvedParams.user);
  const direction = valueOf(resolvedParams.direction);
  const source = valueOf(resolvedParams.source);
  const dateFrom = valueOf(resolvedParams.dateFrom);
  const dateTo = valueOf(resolvedParams.dateTo);
  const page = parsePageParam(valueOf(resolvedParams.page));
  const transactions = await getAdminXpLedger(supabase, {
    userQuery: userQuery || undefined,
    direction: direction === "earn" || direction === "spend" ? direction : undefined,
    sourceType:
      source === "quiz_question" ||
      source === "mission" ||
      source === "reward_redemption" ||
      source === "adjustment"
        ? source
        : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });
  const hasFilters = Boolean(userQuery || direction || source || dateFrom || dateTo);
  const paginatedTransactions = paginateItems(transactions, page, 25);

  return (
    <>
      <AdminPageHeader
        backHref="/admin"
        backLabel="Admin overview"
        eyebrow="Audit"
        title="XP ledger"
        subtitle="Filter by user, date, source, and direction. The ledger stays read-only and always shows the newest matching entries first."
      />
      <AdminCard className="mb-6">
        <form action="/admin/xp-ledger" className="space-y-4" method="get">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <label>
              <span className={labelClasses()}>User</span>
              <input
                className={fieldClasses()}
                defaultValue={userQuery}
                name="user"
                placeholder="Name, referral code, or user id"
              />
            </label>
            <label>
              <span className={labelClasses()}>Direction</span>
              <select className={fieldClasses()} defaultValue={direction} name="direction">
                {directionOptions.map((option) => (
                  <option key={option.label} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={labelClasses()}>Source</span>
              <select className={fieldClasses()} defaultValue={source} name="source">
                {sourceOptions.map((option) => (
                  <option key={option.label} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={labelClasses()}>From</span>
              <input className={fieldClasses()} defaultValue={dateFrom} name="dateFrom" type="date" />
            </label>
            <label>
              <span className={labelClasses()}>To</span>
              <input className={fieldClasses()} defaultValue={dateTo} name="dateTo" type="date" />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button className="rounded-[14px] bg-[#087f5b] px-5 py-3 text-sm font-black text-white" type="submit">
              Apply filters
            </button>
            <Link
              className="rounded-[14px] bg-[#fff8df] px-5 py-3 text-sm font-black text-[var(--foreground)]"
              href="/admin/xp-ledger"
            >
              Reset
            </Link>
            <p className="text-xs font-semibold text-[var(--ve-muted)]">
              Showing {paginatedTransactions.startItem}-{paginatedTransactions.endItem} of {paginatedTransactions.totalItems} matching entries{hasFilters ? " for the current filter set" : ""}.
            </p>
          </div>
        </form>
      </AdminCard>
      {transactions.length === 0 ? (
        <EmptyAdminState>No XP transactions match the current filters.</EmptyAdminState>
      ) : (
        <>
        <AdminTable columns={["When", "User", "Direction", "Amount", "Source", "Scope"]}>
          {paginatedTransactions.items.map((transaction) => (
            <tr key={transaction.id}>
              <td className="whitespace-nowrap px-4 py-4">
                {formatRewardDate(transaction.created_at)}
              </td>
              <td className="min-w-[220px] px-4 py-4">
                <p className="font-black">{transaction.profile?.display_name ?? "Unknown user"}</p>
                <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">
                  {transaction.profile?.referral_code ?? transaction.user_id.slice(0, 8)}
                </p>
              </td>
              <td className="whitespace-nowrap px-4 py-4">
                <AdminStatusBadge tone={transaction.direction === "earn" ? "good" : "store"}>
                  {transaction.direction}
                </AdminStatusBadge>
              </td>
              <td className="whitespace-nowrap px-4 py-4 font-black tabular-nums">
                {transaction.direction === "earn" ? "+" : "-"}
                {formatXpLabel(transaction.amount)}
              </td>
              <td className="whitespace-nowrap px-4 py-4 capitalize">
                {transaction.source_type.replaceAll("_", " ")}
              </td>
              <td className="min-w-[220px] px-4 py-4 text-xs font-semibold text-[var(--ve-muted-strong)]">
                {transaction.award_scope ?? transaction.source_id}
              </td>
            </tr>
          ))}
        </AdminTable>
        <AdminPagination
          basePath="/admin/xp-ledger"
          currentPage={paginatedTransactions.currentPage}
          searchParams={{ user: userQuery || undefined, direction: direction || undefined, source: source || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined }}
          summary={`Showing ${paginatedTransactions.startItem}-${paginatedTransactions.endItem} of ${paginatedTransactions.totalItems} ledger entries`}
          totalPages={paginatedTransactions.totalPages}
        />
        </>
      )}
    </>
  );
}
