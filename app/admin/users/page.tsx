import {
  AdminCard,
  AdminNoticeBanner,
  AdminPagination,
  AdminPageHeader,
  AdminStatusBadge,
  AdminTable,
  EmptyAdminState,
} from "@/components/admin/AdminPrimitives";
import { getAdminManualXpGrantStatus, getAdminUsers, requireAdmin } from "@/lib/admin";
import { paginateItems, parsePageParam } from "@/lib/pagination";
import { formatRewardDate } from "@/lib/rewards";
import { formatXpLabel } from "@/lib/xp-format";
import { grantUserXp } from "./actions";

function riskTone(status: string) {
  if (status === "clear") return "good" as const;
  if (status === "watch") return "warning" as const;
  return "danger" as const;
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams?: Promise<{ notice?: string; page?: string }>;
}) {
  const { supabase } = await requireAdmin();
  const { notice, page } = (await searchParams) ?? {};
  const [users, grantStatus] = await Promise.all([
    getAdminUsers(supabase),
    getAdminManualXpGrantStatus(supabase),
  ]);
  const paginatedUsers = paginateItems(users, parsePageParam(page), 20);
  const remainingGrant = Math.max(0, grantStatus?.remaining_today ?? 0);
  const grantLimit = grantStatus?.daily_limit ?? 0;
  const grantedToday = grantStatus?.granted_today ?? 0;
  const canGrantXp = remainingGrant > 0;

  return (
    <>
      <AdminPageHeader
        backHref="/admin"
        backLabel="Admin overview"
        eyebrow="Accounts"
        title="Users"
        subtitle="Review learner accounts, fraud status, and grant controlled free XP for testing without bypassing daily admin safety limits."
      />
      {notice ? <AdminNoticeBanner>{notice}</AdminNoticeBanner> : null}
      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <AdminCard>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">
            Manual XP granted today
          </p>
          <p className="mt-3 text-3xl font-black tabular-nums text-[color:color-mix(in_srgb,var(--ve-store)_62%,var(--foreground))]">
            {formatXpLabel(grantedToday)}
          </p>
        </AdminCard>
        <AdminCard>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">
            Remaining grant quota
          </p>
          <p className="mt-3 text-3xl font-black tabular-nums text-[var(--ve-green)]">
            {formatXpLabel(remainingGrant)}
          </p>
        </AdminCard>
        <AdminCard>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">
            Daily safety limit
          </p>
          <p className="mt-3 text-3xl font-black tabular-nums">{formatXpLabel(grantLimit)}</p>
          <p className="mt-2 text-xs font-semibold text-[var(--ve-muted)]">
            This resets each day in Africa/Lagos time.
          </p>
        </AdminCard>
      </section>
      {users.length === 0 ? (
        <EmptyAdminState>No users found.</EmptyAdminState>
      ) : (
        <>
        <AdminTable columns={["User", "XP", "Role", "Risk", "Redemption unlock", "Grant XP", "Created"]}>
          {paginatedUsers.items.map((user) => (
            <tr key={user.id}>
              <td className="min-w-[240px] px-4 py-4">
                <p className="font-black">{user.display_name ?? "Unnamed learner"}</p>
                <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">
                  {user.referral_code ?? user.id}
                </p>
              </td>
              <td className="whitespace-nowrap px-4 py-4 font-black tabular-nums">
                {formatXpLabel(user.xp_balance_cached)}
              </td>
              <td className="whitespace-nowrap px-4 py-4">
                <AdminStatusBadge tone={user.role === "admin" ? "store" : "neutral"}>
                  {user.role}
                </AdminStatusBadge>
              </td>
              <td className="whitespace-nowrap px-4 py-4">
                <AdminStatusBadge tone={riskTone(user.fraud_review_status)}>
                  {user.fraud_review_status}
                </AdminStatusBadge>
              </td>
              <td className="whitespace-nowrap px-4 py-4">
                {formatRewardDate(user.redemption_unlocked_at)}
              </td>
              <td className="min-w-[320px] px-4 py-4">
                <form action={grantUserXp} className="space-y-2">
                  <input name="targetUserId" type="hidden" value={user.id} />
                  <input
                    name="redirectTo"
                    type="hidden"
                    value={page && page !== "1" ? `/admin/users?page=${page}` : "/admin/users"}
                  />
                  <div className="grid gap-2 sm:grid-cols-[96px_minmax(0,1fr)_auto]">
                    <input
                      className="rounded-[12px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 py-2 text-sm font-bold outline-none transition focus:border-[var(--ve-green)] focus:ring-4 focus:ring-[color:color-mix(in_srgb,var(--ve-green)_10%,transparent)]"
                      defaultValue=""
                      min={1}
                      name="amount"
                      placeholder="XP"
                      required
                      type="number"
                    />
                    <input
                      className="rounded-[12px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 py-2 text-sm font-semibold outline-none transition focus:border-[var(--ve-green)] focus:ring-4 focus:ring-[color:color-mix(in_srgb,var(--ve-green)_10%,transparent)]"
                      defaultValue=""
                      maxLength={200}
                      name="reason"
                      placeholder="Testing reason"
                      type="text"
                    />
                    <button
                      className="rounded-[12px] bg-[var(--ve-green)] px-4 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={!canGrantXp}
                      type="submit"
                    >
                      Grant
                    </button>
                  </div>
                  <p className="text-[11px] font-semibold text-[var(--ve-muted)]">
                    {canGrantXp
                      ? `${formatXpLabel(remainingGrant)} remaining in today’s admin grant quota.`
                      : "Today’s admin grant quota is exhausted."}
                  </p>
                </form>
              </td>
              <td className="whitespace-nowrap px-4 py-4">{formatRewardDate(user.created_at)}</td>
            </tr>
          ))}
        </AdminTable>
        <AdminPagination
          basePath="/admin/users"
          currentPage={paginatedUsers.currentPage}
          summary={`Showing ${paginatedUsers.startItem}-${paginatedUsers.endItem} of ${paginatedUsers.totalItems} users`}
          totalPages={paginatedUsers.totalPages}
        />
        </>
      )}
    </>
  );
}
