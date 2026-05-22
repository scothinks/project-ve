import {
  AdminCard,
  AdminNoticeBanner,
  AdminPagination,
  AdminPageHeader,
  AdminStatusBadge,
  EmptyAdminState,
} from "@/components/admin/AdminPrimitives";
import { getAdminProofSubmissions, requireAdmin } from "@/lib/admin";
import { getMissionRewardLabel } from "@/lib/missions";
import { paginateItems, parsePageParam } from "@/lib/pagination";
import { formatRewardDate } from "@/lib/rewards";
import { reviewProofSubmission } from "./actions";

function proofTone(status: string) {
  if (status === "approved") return "good" as const;
  if (status === "rejected") return "danger" as const;
  return "warning" as const;
}

export default async function AdminProofsPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string; notice?: string }>;
}) {
  const { supabase } = await requireAdmin();
  const submissions = await getAdminProofSubmissions(supabase);
  const { page, notice } = (await searchParams) ?? {};
  const paginatedSubmissions = paginateItems(submissions, parsePageParam(page), 12);

  return (
    <>
      <AdminPageHeader
        backHref="/admin/missions"
        backLabel="Missions"
        eyebrow="Missions"
        title="Proof review"
        subtitle="Approve valid proof submissions to award mission rewards, or reject with a clear reason."
      />
      {notice ? <AdminNoticeBanner>{notice}</AdminNoticeBanner> : null}
      {submissions.length === 0 ? (
        <EmptyAdminState>No proof submissions found.</EmptyAdminState>
      ) : (
        <>
        <section className="space-y-4">
          {paginatedSubmissions.items.map((submission) => (
            <AdminCard key={submission.key}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-black">
                      {submission.mission?.title ?? submission.missionId}
                    </h2>
                    <AdminStatusBadge tone={proofTone(submission.status)}>
                      {submission.status.replaceAll("_", " ")}
                    </AdminStatusBadge>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-[var(--ve-muted-strong)]">
                    {submission.profile?.display_name ?? "Unknown user"}
                    {submission.mission
                      ? ` · ${getMissionRewardLabel({
                          rewardType: submission.mission.reward_type,
                          rewardXp: submission.mission.reward_xp,
                          rewardTitle: submission.mission.reward?.title ?? null,
                        })}`
                      : ""}
                  </p>
                  <p className="mt-1 text-xs font-bold text-[var(--ve-muted)]">
                    Scope: {submission.awardScope} · Submitted{" "}
                    {formatRewardDate(submission.createdAt)}
                  </p>
                </div>

                {submission.status === "submitted" ? (
                  <div className="grid w-full max-w-md gap-2 md:grid-cols-2">
                    <form action={reviewProofSubmission}>
                      <input name="userId" type="hidden" value={submission.userId} />
                      <input name="missionId" type="hidden" value={submission.missionId} />
                      <input name="awardScope" type="hidden" value={submission.awardScope} />
                      <input name="status" type="hidden" value="approved" />
                      <button
                        className="h-10 w-full rounded-[12px] bg-[#e4f4ed] px-3 text-xs font-black text-[#087f5b]"
                        type="submit"
                      >
                        Approve
                      </button>
                    </form>
                    <form action={reviewProofSubmission} className="flex gap-2">
                      <input name="userId" type="hidden" value={submission.userId} />
                      <input name="missionId" type="hidden" value={submission.missionId} />
                      <input name="awardScope" type="hidden" value={submission.awardScope} />
                      <input name="status" type="hidden" value="rejected" />
                      <input
                        className="min-w-0 flex-1 rounded-[12px] border border-[#e1ddd5] px-3 text-xs font-semibold outline-none"
                        maxLength={500}
                        name="rejectionReason"
                        placeholder="Reason"
                      />
                      <button
                        className="h-10 rounded-[12px] bg-[#fff0f0] px-3 text-xs font-black text-[#c00000]"
                        type="submit"
                      >
                        Reject
                      </button>
                    </form>
                  </div>
                ) : null}
              </div>

              <div className="mt-4 grid gap-3 border-t border-[var(--ve-line-soft)] pt-4 md:grid-cols-2">
                {submission.proofs.map((proof) => (
                  <div className="rounded-[14px] bg-[var(--ve-panel)] p-3" key={proof.id}>
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]">
                      {proof.proof_type}
                    </p>
                    <p className="mt-1 break-words text-sm font-bold leading-6">{proof.value}</p>
                  </div>
                ))}
              </div>
            </AdminCard>
          ))}
        </section>
        <AdminPagination
          basePath="/admin/proofs"
          currentPage={paginatedSubmissions.currentPage}
          summary={`Showing ${paginatedSubmissions.startItem}-${paginatedSubmissions.endItem} of ${paginatedSubmissions.totalItems} proof submissions`}
          totalPages={paginatedSubmissions.totalPages}
        />
        </>
      )}
    </>
  );
}
