import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { RewardEditorForm } from "@/components/admin/RewardEditorForm";
import {
  AdminCard,
  AdminPagination,
  AdminPageHeader,
  AdminStatusBadge,
  AdminTable,
  EmptyAdminState,
} from "@/components/admin/AdminPrimitives";
import { getAdminCampaigns, getAdminRewardDetail, requireAdmin } from "@/lib/admin";
import { paginateItems, parsePageParam } from "@/lib/pagination";
import { getRewardThumbnailEditorState } from "@/lib/reward-icons";
import { formatRewardDate } from "@/lib/rewards";
import { formatXpLabel } from "@/lib/xp-format";
import { updateReward } from "./actions";

type AdminRewardDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ inventoryPage?: string; adjustmentsPage?: string }>;
};

function toDateInputValue(iso: string | null) {
  if (!iso) {
    return "";
  }

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 16);
}

function getString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

function getClaimSteps(value: unknown) {
  return Array.isArray(value) ? value.filter((step): step is string => typeof step === "string") : [];
}

function getInventoryValue(payload: Record<string, unknown>, itemType: string) {
  if (itemType === "voucher_code") {
    return typeof payload.code === "string" ? payload.code : "";
  }

  return typeof payload.qrPayload === "string" ? payload.qrPayload : "";
}

export default async function AdminRewardDetailPage({ params, searchParams }: AdminRewardDetailPageProps) {
  const { id } = await params;
  const { inventoryPage, adjustmentsPage } = (await searchParams) ?? {};
  const { supabase } = await requireAdmin();
  const [detail, campaigns] = await Promise.all([
    getAdminRewardDetail(supabase, id),
    getAdminCampaigns(supabase),
  ]);

  if (!detail) {
    notFound();
  }

  if (detail.reward.distribution_mode === "perk_bundle" || detail.reward.fulfillment_type === "perk_bundle") {
    redirect(`/admin/rewards/perks/${detail.reward.id}`);
  }

  const { reward, inventoryItems, adjustments, perkPrizes, perkRewardCandidates } = detail;
  const inventoryMode =
    reward.fulfillment_type === "voucher_code" || reward.fulfillment_type === "qr_code"
      ? "items"
      : "quantity";
  const thumbnail = reward.thumbnail ?? {};
  const thumbnailEditor = getRewardThumbnailEditorState({
    url: getString(thumbnail, "url") || undefined,
    icon: getString(thumbnail, "icon") || undefined,
    iconSet: getString(thumbnail, "iconSet") === "tabler" ? "tabler" : undefined,
    iconName: getString(thumbnail, "iconName") || undefined,
    color: getString(thumbnail, "color") || undefined,
  });
  const claimSteps = getClaimSteps(reward.claim_steps);
  const paginatedInventoryItems = paginateItems(inventoryItems, parsePageParam(inventoryPage), 10);
  const paginatedAdjustments = paginateItems(adjustments, parsePageParam(adjustmentsPage), 10);

  return (
    <>
      <AdminPageHeader
        backHref="/admin/rewards"
        backLabel="Rewards"
        eyebrow="XP Store"
        title={reward.title}
        subtitle="Edit reward configuration, control availability, and manage quantity or uploaded voucher/QR inventory."
      />

      <section className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <AdminCard>
          <RewardEditorForm
            action={updateReward}
            campaigns={campaigns}
            lockDistributionMode="direct"
            mode="edit"
            reward={{
              id: reward.id,
              title: reward.title,
              description: reward.description ?? "",
              costXp: reward.cost_xp,
              status: reward.status,
              isEnabled: reward.is_enabled,
              distributionMode: reward.distribution_mode,
              fulfillmentType: reward.fulfillment_type,
              visibilityMode: reward.visibility_mode,
              fulfillmentConfig: reward.fulfillment_config ?? {},
              perUserLimit: reward.per_user_limit,
              limitPeriod: reward.limit_period,
              redemptionWindowDays: reward.redemption_window_days ?? "",
              sortOrder: reward.sort_order,
              offerExpiresAt: toDateInputValue(reward.offer_expires_at),
              thumbnailUrl: getString(thumbnail, "url"),
              thumbnailIconName: thumbnailEditor.iconName,
              thumbnailLegacyIcon: thumbnailEditor.legacyIcon,
              thumbnailColor: getString(thumbnail, "color"),
              terms: reward.terms ?? "",
              claimSteps,
              campaignId: reward.campaign_id,
            }}
          />
        </AdminCard>

        <aside className="space-y-4">
          <AdminCard>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">
              Status
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <AdminStatusBadge tone={reward.status === "published" ? "good" : "warning"}>
                {reward.status}
              </AdminStatusBadge>
              <AdminStatusBadge tone={reward.is_enabled ? "good" : "danger"}>
                {reward.is_enabled ? "enabled" : "disabled"}
              </AdminStatusBadge>
            </div>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="font-black text-[var(--ve-muted)]">Campaign</dt>
                <dd className="mt-1 font-bold">{reward.campaign?.name ?? "No campaign"}</dd>
              </div>
              <div>
                <dt className="font-black text-[var(--ve-muted)]">Mode</dt>
                <dd className="mt-1 font-bold">{reward.distribution_mode.replaceAll("_", " ")}</dd>
              </div>
              <div>
                <dt className="font-black text-[var(--ve-muted)]">Cost</dt>
                <dd className="mt-1 font-black">{formatXpLabel(reward.cost_xp)}</dd>
              </div>
              <div>
                <dt className="font-black text-[var(--ve-muted)]">Inventory</dt>
                <dd className="mt-1 font-black tabular-nums">
                  {reward.total_available}/{reward.total_uploaded}
                </dd>
              </div>
              <div>
                <dt className="font-black text-[var(--ve-muted)]">Visibility</dt>
                <dd className="mt-1 font-bold">{reward.visibility_mode.replaceAll("_", " ")}</dd>
              </div>
              <div>
                <dt className="font-black text-[var(--ve-muted)]">Offer ends</dt>
                <dd className="mt-1 font-bold">{formatRewardDate(reward.offer_expires_at)}</dd>
              </div>
            </dl>
          </AdminCard>

          <AdminCard>
            <h2 className="text-lg font-black">Inventory</h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-[var(--ve-muted-strong)]">
              Add stock, assign batches, and track partner uploads from the central inventory page.
            </p>
            <Link
              className="mt-4 inline-flex w-full items-center justify-center rounded-[14px] bg-[color:color-mix(in_srgb,var(--ve-store-soft)_82%,var(--ve-card))] px-4 py-3 text-sm font-black text-[color:color-mix(in_srgb,var(--ve-store)_62%,var(--foreground))]"
              href={`/admin/inventory/new?rewardId=${encodeURIComponent(reward.id)}&mode=${inventoryMode}`}
            >
              Manage inventory
            </Link>
          </AdminCard>
        </aside>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-2">
        <div>
          <h2 className="mb-3 text-lg font-black">Recent inventory</h2>
          {inventoryItems.length === 0 ? (
            <EmptyAdminState>No item inventory uploaded.</EmptyAdminState>
          ) : (
            <>
              <AdminTable columns={["Item", "Status", "Available", "Expires"]}>
                {paginatedInventoryItems.items.map((item) => (
                  <tr key={item.id}>
                    <td className="max-w-[320px] px-4 py-3">
                      <p className="truncate font-bold">
                        {getInventoryValue(item.payload, item.item_type)}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">
                        {item.item_type.replaceAll("_", " ")}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <AdminStatusBadge tone={item.status === "available" ? "good" : "neutral"}>
                        {item.status}
                      </AdminStatusBadge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">{formatRewardDate(item.available_from)}</td>
                    <td className="whitespace-nowrap px-4 py-3">{formatRewardDate(item.expires_at)}</td>
                  </tr>
                ))}
              </AdminTable>
              <AdminPagination
                basePath={`/admin/rewards/${reward.id}`}
                currentPage={paginatedInventoryItems.currentPage}
                searchParams={{ adjustmentsPage: adjustmentsPage || undefined }}
                summary={`Showing ${paginatedInventoryItems.startItem}-${paginatedInventoryItems.endItem} of ${paginatedInventoryItems.totalItems} inventory items`}
                totalPages={paginatedInventoryItems.totalPages}
              />
            </>
          )}
        </div>

        <div>
          <h2 className="mb-3 text-lg font-black">Quantity adjustments</h2>
          {adjustments.length === 0 ? (
            <EmptyAdminState>No manual quantity adjustments.</EmptyAdminState>
          ) : (
            <>
              <AdminTable columns={["Change", "Reason", "When"]}>
                {paginatedAdjustments.items.map((adjustment) => (
                  <tr key={adjustment.id}>
                    <td className="whitespace-nowrap px-4 py-3 font-black tabular-nums">
                      {adjustment.delta > 0 ? "+" : ""}
                      {adjustment.delta}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-[var(--ve-muted-strong)]">
                      {adjustment.reason}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">{formatRewardDate(adjustment.created_at)}</td>
                  </tr>
                ))}
              </AdminTable>
              <AdminPagination
                basePath={`/admin/rewards/${reward.id}`}
                currentPage={paginatedAdjustments.currentPage}
                searchParams={{ inventoryPage: inventoryPage || undefined }}
                summary={`Showing ${paginatedAdjustments.startItem}-${paginatedAdjustments.endItem} of ${paginatedAdjustments.totalItems} adjustments`}
                totalPages={paginatedAdjustments.totalPages}
              />
            </>
          )}
        </div>
      </section>

      <AdminCard className="mt-6">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">
          Perks
        </p>
        <h2 className="mt-2 text-xl font-black">Manage low-XP perks separately</h2>
        <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[var(--ve-muted-strong)]">
          Perk bundles have their own admin experience. Use the perks area to control prize pools,
          weights, release timing, and assigned rewards.
        </p>
        <Link
          className="mt-4 inline-flex rounded-[14px] bg-[color:color-mix(in_srgb,var(--ve-violet-soft)_82%,var(--ve-card))] px-4 py-3 text-sm font-black text-[var(--ve-violet)]"
          href="/admin/rewards/perks"
        >
          Open perks
        </Link>
      </AdminCard>
    </>
  );
}
