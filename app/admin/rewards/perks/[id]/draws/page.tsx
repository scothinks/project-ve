import { notFound, redirect } from "next/navigation";
import {
  AdminCard,
  AdminPagination,
  AdminPageHeader,
  AdminStatusBadge,
  AdminTable,
  EmptyAdminState,
} from "@/components/admin/AdminPrimitives";
import { getAdminPerkDraws, getAdminRewardDetail, requireAdmin } from "@/lib/admin";
import { paginateItems, parsePageParam } from "@/lib/pagination";
import { formatRewardDate } from "@/lib/rewards";

type AdminPerkDrawsPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ page?: string }>;
};

export default async function AdminPerkDrawsPage({ params, searchParams }: AdminPerkDrawsPageProps) {
  const { id } = await params;
  const { page } = (await searchParams) ?? {};
  const { supabase } = await requireAdmin();
  const detail = await getAdminRewardDetail(supabase, id);

  if (!detail) {
    notFound();
  }

  if (detail.reward.distribution_mode !== "perk_bundle" && detail.reward.fulfillment_type !== "perk_bundle") {
    redirect(`/admin/rewards/${detail.reward.id}`);
  }

  const draws = await getAdminPerkDraws(supabase, id, 250);
  const paginatedDraws = paginateItems(draws, parsePageParam(page), 25);

  return (
    <>
      <AdminPageHeader
        backHref={`/admin/rewards/perks/${detail.reward.id}`}
        backLabel="Perk"
        eyebrow="XP Store"
        title={`${detail.reward.title} draws`}
        subtitle="Inspect recent winners, fallback usage, and the exact reward outcomes this perk is generating."
      />

      <AdminCard className="mb-6">
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]">Total shown</p>
            <p className="mt-2 text-2xl font-black">{draws.length}</p>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]">Fallbacks</p>
            <p className="mt-2 text-2xl font-black">{draws.filter((draw) => !draw.prize_id).length}</p>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]">Refunded</p>
            <p className="mt-2 text-2xl font-black">{draws.filter((draw) => draw.award_status === "refunded").length}</p>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]">Latest draw</p>
            <p className="mt-2 text-sm font-black">{draws[0] ? formatRewardDate(draws[0].created_at) : "No draws yet"}</p>
          </div>
        </div>
      </AdminCard>

      {draws.length === 0 ? (
        <EmptyAdminState>No draws yet.</EmptyAdminState>
      ) : (
        <>
          <AdminTable columns={["When", "User", "Outcome", "Delivery", "State"]}>
            {paginatedDraws.items.map((draw) => (
              <tr key={draw.id}>
                <td className="whitespace-nowrap px-4 py-3">{formatRewardDate(draw.created_at)}</td>
                <td className="px-4 py-3">
                  <p className="font-black">{draw.profile?.display_name ?? draw.profile?.referral_code ?? "Learner"}</p>
                  <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">{draw.profile?.id ?? draw.user_id}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="font-black">{draw.awarded_title}</p>
                  <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">
                    {draw.prize_id ? "Prize pool" : "Fallback"}
                  </p>
                </td>
                <td className="whitespace-nowrap px-4 py-3 capitalize">
                  {draw.awarded_fulfillment_type.replaceAll("_", " ")}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <AdminStatusBadge tone={draw.award_status === "awarded" ? "good" : "neutral"}>
                    {draw.award_status}
                  </AdminStatusBadge>
                </td>
              </tr>
            ))}
          </AdminTable>
          <AdminPagination
            basePath={`/admin/rewards/perks/${detail.reward.id}/draws`}
            currentPage={paginatedDraws.currentPage}
            summary={`Showing ${paginatedDraws.startItem}-${paginatedDraws.endItem} of ${paginatedDraws.totalItems} draws`}
            totalPages={paginatedDraws.totalPages}
          />
        </>
      )}
    </>
  );
}
