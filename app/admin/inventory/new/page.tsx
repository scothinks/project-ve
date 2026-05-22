import {
  AdminCard,
  AdminPageHeader,
  AdminStatusBadge,
} from "@/components/admin/AdminPrimitives";
import { InventoryBatchUploadForm } from "@/components/admin/InventoryBatchUploadForm";
import { getAdminCampaigns, getAdminRewards, requireAdmin } from "@/lib/admin";
import { setInventoryQuantity } from "../actions";

function fieldClasses() {
  return "mt-1 w-full rounded-[12px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 py-2 text-sm font-semibold outline-none focus:border-[#087f5b]";
}

function labelClasses() {
  return "text-xs font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]";
}

type NewInventoryPageProps = {
  searchParams?: Promise<{
    count?: string;
    mode?: string;
    rewardId?: string;
    saved?: string;
  }>;
};

function getSavedMessage(saved?: string, count?: string) {
  if (saved === "quantity") {
    return "Quantity allocation saved.";
  }

  if (saved === "batch") {
    return `${count ?? "Batch"} inventory item${count === "1" ? "" : "s"} imported.`;
  }

  return "";
}

export default async function NewInventoryPage({ searchParams }: NewInventoryPageProps) {
  const params = (await searchParams) ?? {};
  const { supabase } = await requireAdmin();
  const [campaigns, rewards] = await Promise.all([
    getAdminCampaigns(supabase),
    getAdminRewards(supabase),
  ]);
  const activeCampaignId = campaigns.find((campaign) => campaign.status === "active")?.id ?? "";
  const quantityRewards = rewards.filter(
    (reward) => reward.fulfillment_type !== "voucher_code" && reward.fulfillment_type !== "qr_code",
  );
  const selectedRewardId = params.rewardId ?? "";
  const savedMessage = getSavedMessage(params.saved, params.count);

  return (
    <>
      <AdminPageHeader
        backHref="/admin/rewards"
        backLabel="Rewards"
        eyebrow="Inventory"
        title="Add inventory"
        subtitle="Upload or update reward inventory against a campaign, budget period, partner batch, or one-off allocation."
      />

      {savedMessage ? (
        <div className="mb-4">
          <AdminStatusBadge tone="good">{savedMessage}</AdminStatusBadge>
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <AdminCard>
          <h2 className="text-lg font-black">Quantity allocation</h2>
          <p className="mt-1 text-sm font-semibold leading-6 text-[var(--ve-muted-strong)]">
            For manual, native, and external-link rewards. Add scheduled quantity for a campaign or partner period.
          </p>
          <form action={setInventoryQuantity} className="mt-5 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label>
                <span className={labelClasses()}>Campaign</span>
                <select className={fieldClasses()} name="campaignId" defaultValue={activeCampaignId}>
                  <option value="">No campaign</option>
                  {campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className={labelClasses()}>Reward</span>
                <select className={fieldClasses()} name="rewardId" required defaultValue={selectedRewardId}>
                  <option value="">Select reward</option>
                  {quantityRewards.map((reward) => (
                    <option key={reward.id} value={reward.id}>{reward.title}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <label>
                <span className={labelClasses()}>Available quantity</span>
                <input className={fieldClasses()} min={0} name="totalAvailable" required type="number" />
              </label>
              <label>
                <span className={labelClasses()}>Available from</span>
                <input className={fieldClasses()} name="availableFrom" type="datetime-local" />
              </label>
              <label>
                <span className={labelClasses()}>Expires</span>
                <input className={fieldClasses()} name="expiresAt" type="datetime-local" />
              </label>
              <label>
                <span className={labelClasses()}>Batch label</span>
                <input className={fieldClasses()} maxLength={160} name="batchLabel" placeholder="May allocation" />
              </label>
              <label>
                <span className={labelClasses()}>Partner ref</span>
                <input className={fieldClasses()} maxLength={160} name="partnerReference" placeholder="partner-batch-01" />
              </label>
            </div>
            <label className="block">
              <span className={labelClasses()}>Reason</span>
              <input className={fieldClasses()} maxLength={300} name="reason" placeholder="Partner confirmed stock for this campaign" />
            </label>
            <button className="rounded-[14px] bg-[#087f5b] px-5 py-3 text-sm font-black text-white" type="submit">
              Add quantity
            </button>
          </form>
        </AdminCard>

        <AdminCard>
          <h2 className="text-lg font-black">Voucher or QR batch upload</h2>
          <p className="mt-1 text-sm font-semibold leading-6 text-[var(--ve-muted-strong)]">
            For voucher and QR rewards. Upload a single-reward batch so large partner files stay easy to audit.
          </p>
          <InventoryBatchUploadForm
            activeCampaignId={activeCampaignId}
            campaigns={campaigns}
            rewards={rewards}
            selectedRewardId={selectedRewardId}
          />
        </AdminCard>
      </section>
    </>
  );
}
