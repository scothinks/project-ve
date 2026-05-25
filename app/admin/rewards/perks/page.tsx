import Link from "next/link";
import { CampaignFilterSelect } from "@/components/admin/CampaignFilterSelect";
import {
  AdminCard,
  AdminNoticeBanner,
  AdminPagination,
  AdminPageHeader,
  AdminStatCard,
  AdminStatusBadge,
  EmptyAdminState,
} from "@/components/admin/AdminPrimitives";
import { getAdminCampaigns, getAdminPerkPrograms, requireAdmin } from "@/lib/admin";
import { paginateItems, parsePageParam } from "@/lib/pagination";
import { formatRewardDate } from "@/lib/rewards";
import { formatXpLabel } from "@/lib/xp-format";
import { setRewardStatus, toggleRewardEnabled } from "../[id]/actions";

function getStorefrontState(perk: {
  status: string;
  is_enabled: boolean;
  visibility_mode: string;
  starts_at: string | null;
  ends_at: string | null;
  offer_expires_at: string | null;
  campaign?: { status: string; starts_at: string | null; ends_at: string | null } | null;
}, options: { hasAvailableOutcomes: boolean }) {
  const now = Date.now();
  const perkStartsAt = perk.starts_at ? new Date(perk.starts_at).getTime() : null;
  const perkEndsAt = perk.ends_at ? new Date(perk.ends_at).getTime() : null;
  const offerEndsAt = perk.offer_expires_at ? new Date(perk.offer_expires_at).getTime() : null;
  const campaignStartsAt = perk.campaign?.starts_at ? new Date(perk.campaign.starts_at).getTime() : null;
  const campaignEndsAt = perk.campaign?.ends_at ? new Date(perk.campaign.ends_at).getTime() : null;

  if (perk.status !== "published" || !perk.is_enabled) return "paused";
  if (perk.visibility_mode === "hidden") return "hidden";
  if (perk.visibility_mode === "system_only") return "system only";
  if (perk.visibility_mode === "campaign_only") return "campaign only";
  if (!perk.campaign || perk.campaign.status !== "active") return "campaign off";
  if ((campaignStartsAt && campaignStartsAt > now) || (perkStartsAt && perkStartsAt > now)) return "scheduled";
  if (
    (campaignEndsAt && campaignEndsAt <= now)
    || (perkEndsAt && perkEndsAt <= now)
    || (offerEndsAt && offerEndsAt <= now)
  ) return "ended";
  if (!options.hasAvailableOutcomes) return "pool empty";
  return "live";
}

function badgeTone(state: string) {
  if (state === "live") return "good" as const;
  if (state === "scheduled" || state === "pool empty") return "warning" as const;
  if (state === "paused") return "danger" as const;
  return "neutral" as const;
}

type AdminPerksPageProps = {
  searchParams: Promise<{ campaign?: string; page?: string; notice?: string }>;
};

export default async function AdminPerksPage({ searchParams }: AdminPerksPageProps) {
  const { campaign, page, notice } = await searchParams;
  const { supabase } = await requireAdmin();
  const [programs, campaigns] = await Promise.all([
    getAdminPerkPrograms(supabase, { campaignId: campaign }),
    getAdminCampaigns(supabase),
  ]);

  const livePrograms = programs.filter((program) =>
    getStorefrontState(program.reward, {
      hasAvailableOutcomes: program.enabledPrizeCount > 0 || program.fallbackConfigured,
    }) === "live");
  const totalDrawsToday = programs.reduce((sum, program) => sum + program.drawsToday, 0);
  const totalFallbackArmed = programs.filter((program) => program.fallbackConfigured).length;
  const paginatedPrograms = paginateItems(programs, parsePageParam(page), 12);

  return (
    <>
      <AdminPageHeader
        backHref="/admin"
        backLabel="Admin overview"
        eyebrow="XP Store"
        title="Perks"
        subtitle="Run low-XP perks like distribution programs. Track access, prize-pool health, and draw activity without digging through generic reward settings."
      />
      {notice ? <AdminNoticeBanner>{notice}</AdminNoticeBanner> : null}

      <section className="mb-6 grid gap-4 md:grid-cols-4">
        <AdminStatCard label="Perk programs" value={programs.length} />
        <AdminStatCard label="Live now" tone="mission" value={livePrograms.length} />
        <AdminStatCard label="Fallback armed" tone="store" value={totalFallbackArmed} />
        <AdminStatCard label="Draws today" tone="mission" value={totalDrawsToday} />
      </section>

      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <CampaignFilterSelect campaigns={campaigns} value={campaign} />
        <div className="flex flex-wrap gap-2 md:justify-end">
          <Link
            className="inline-flex h-12 min-w-36 items-center justify-center rounded-[14px] bg-[color:color-mix(in_srgb,var(--ve-store-soft)_82%,var(--ve-card))] px-5 text-sm font-black text-[color:color-mix(in_srgb,var(--ve-store)_62%,var(--foreground))]"
            href="/admin/inventory/new"
          >
            Add Inventory
          </Link>
          <Link
            className="inline-flex h-12 min-w-36 items-center justify-center rounded-[14px] bg-[var(--ve-violet)] px-5 text-sm font-black text-white"
            href="/admin/rewards/perks/new"
          >
            Add Perk
          </Link>
        </div>
      </div>

      {programs.length === 0 ? (
        <EmptyAdminState>No perks found.</EmptyAdminState>
      ) : (
        <>
        <div className="space-y-4">
          {paginatedPrograms.items.map((program) => {
            const storefrontState = getStorefrontState(program.reward, {
              hasAvailableOutcomes: program.enabledPrizeCount > 0 || program.fallbackConfigured,
            });

            return (
              <AdminCard key={program.reward.id}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        className="text-2xl font-black hover:text-[var(--ve-violet)]"
                        href={`/admin/rewards/perks/${program.reward.id}`}
                      >
                        {program.reward.title}
                      </Link>
                      <AdminStatusBadge tone={badgeTone(storefrontState)}>{storefrontState}</AdminStatusBadge>
                      <AdminStatusBadge tone={program.fallbackConfigured ? "good" : "warning"}>
                        {program.fallbackConfigured ? "fallback armed" : "fallback missing"}
                      </AdminStatusBadge>
                    </div>
                    <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[var(--ve-muted-strong)]">
                      {program.reward.description}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-6 text-sm">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]">XP cost</p>
                        <p className="mt-1 font-black">{formatXpLabel(program.reward.cost_xp)}</p>
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]">Fallback</p>
                        <p className="mt-1 font-black">{program.fallbackConfigured ? "Armed" : "Missing"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]">Prize pool</p>
                        <p className="mt-1 font-black">{program.enabledPrizeCount}/{program.prizeCount} active</p>
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]">Draw activity</p>
                        <p className="mt-1 font-black">{program.drawsToday} today · {program.drawsTotal} total</p>
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]">Offer ends</p>
                        <p className="mt-1 font-black">{formatRewardDate(program.reward.offer_expires_at)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <Link
                      className="inline-flex h-11 min-w-32 items-center justify-center rounded-[12px] bg-[color:color-mix(in_srgb,var(--ve-violet-soft)_82%,var(--ve-card))] px-4 text-sm font-black text-[var(--ve-violet)]"
                      href={`/admin/rewards/perks/${program.reward.id}`}
                    >
                      Manage pool
                    </Link>
                    {program.reward.status === "draft" ? (
                      <form action={setRewardStatus}>
                        <input name="rewardId" type="hidden" value={program.reward.id} />
                        <input name="status" type="hidden" value="published" />
                        <input
                          name="redirectTo"
                          type="hidden"
                          value={campaign ? `/admin/rewards/perks?campaign=${encodeURIComponent(campaign)}` : "/admin/rewards/perks"}
                        />
                        <button
                          className="inline-flex h-11 min-w-32 items-center justify-center rounded-[12px] bg-[color:color-mix(in_srgb,var(--ve-green-soft)_78%,var(--ve-card))] px-4 text-sm font-black text-[var(--ve-green)]"
                          type="submit"
                        >
                          Publish perk
                        </button>
                      </form>
                    ) : null}
                    {program.reward.status === "published" && program.reward.is_enabled ? (
                      <form action={toggleRewardEnabled}>
                        <input name="rewardId" type="hidden" value={program.reward.id} />
                        <input
                          name="redirectTo"
                          type="hidden"
                          value={campaign ? `/admin/rewards/perks?campaign=${encodeURIComponent(campaign)}` : "/admin/rewards/perks"}
                        />
                        <input name="isEnabled" type="hidden" value="false" />
                        <button
                          className="inline-flex h-11 min-w-32 items-center justify-center rounded-[12px] bg-[color:color-mix(in_srgb,var(--ve-danger-soft)_74%,var(--ve-card))] px-4 text-sm font-black text-[var(--ve-danger)]"
                          type="submit"
                        >
                          Pause perk
                        </button>
                      </form>
                    ) : null}
                    {program.reward.status === "published" && !program.reward.is_enabled ? (
                      <form action={toggleRewardEnabled}>
                        <input name="rewardId" type="hidden" value={program.reward.id} />
                        <input
                          name="redirectTo"
                          type="hidden"
                          value={campaign ? `/admin/rewards/perks?campaign=${encodeURIComponent(campaign)}` : "/admin/rewards/perks"}
                        />
                        <input name="isEnabled" type="hidden" value="true" />
                        <button
                          className="inline-flex h-11 min-w-32 items-center justify-center rounded-[12px] bg-[color:color-mix(in_srgb,var(--ve-green-soft)_78%,var(--ve-card))] px-4 text-sm font-black text-[var(--ve-green)]"
                          type="submit"
                        >
                          Resume perk
                        </button>
                      </form>
                    ) : null}
                    {program.reward.status !== "draft" ? (
                      <form action={setRewardStatus}>
                        <input name="rewardId" type="hidden" value={program.reward.id} />
                        <input name="status" type="hidden" value="draft" />
                        <input
                          name="redirectTo"
                          type="hidden"
                          value={campaign ? `/admin/rewards/perks?campaign=${encodeURIComponent(campaign)}` : "/admin/rewards/perks"}
                        />
                        <button
                          className="inline-flex h-11 min-w-32 items-center justify-center rounded-[12px] bg-[var(--ve-panel)] px-4 text-sm font-black text-[var(--ve-muted-strong)]"
                          type="submit"
                        >
                          Move to draft
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
              </AdminCard>
            );
          })}
        </div>
        <AdminPagination
          basePath="/admin/rewards/perks"
          currentPage={paginatedPrograms.currentPage}
          searchParams={{ campaign: campaign || undefined }}
          summary={`Showing ${paginatedPrograms.startItem}-${paginatedPrograms.endItem} of ${paginatedPrograms.totalItems} perk programs`}
          totalPages={paginatedPrograms.totalPages}
        />
        </>
      )}
    </>
  );
}
