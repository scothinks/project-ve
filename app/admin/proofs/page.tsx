import { EconomyPageHeader as AdminPageHeader } from "@/components/admin/economy/EconomyPrimitives";
import Link from "next/link";
import { ProofDecision } from "@/components/admin/economy/ProofDecision";
import { ProofMedia } from "@/components/admin/economy/ProofMedia";
import { ProofQueue } from "@/components/admin/economy/ProofQueue";
import {
  AdminCard,
  AdminNoticeBanner,
  AdminPagination,
  AdminStatusBadge,
  EmptyAdminState,
} from "@/components/admin/AdminPrimitives";
import {
  getAdminProofSubmissions,
  requireAdminWorkspaceRole,
} from "@/lib/admin";
import { getMissionRewardLabel } from "@/lib/missions";
import { paginateItems, parsePageParam } from "@/lib/pagination";
import { formatRewardDate } from "@/lib/rewards";

const PROOF_REVIEW_ROLES = [
  "organisation_owner",
  "organisation_admin",
  "programme_manager",
  "reviewer",
  "instructor",
];

function proofTone(status: string) {
  if (status === "approved") return "good" as const;
  if (status === "rejected") return "danger" as const;
  return "warning" as const;
}

export default async function AdminProofsPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string; notice?: string; status?: string }>;
}) {
  const { supabase, workspace } =
    await requireAdminWorkspaceRole(PROOF_REVIEW_ROLES);
  const submissions = await getAdminProofSubmissions(supabase, workspace.id);
  const { page, notice, status = "submitted" } = (await searchParams) ?? {};
  const paginatedSubmissions = paginateItems(
    status === "all"
      ? submissions
      : submissions.filter((item) => item.status === status),
    parsePageParam(page),
    12,
  );

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
      <nav aria-label="Proof status" className="mb-5 flex flex-wrap gap-3">
        {[
          ["submitted", "Awaiting review"],
          ["approved", "Approved"],
          ["rejected", "Declined"],
          ["all", "All submissions"],
        ].map(([value, label]) => (
          <Link
            aria-current={status === value ? "page" : undefined}
            className="rounded-full border border-[var(--ui-border-subtle)] px-4 py-2 text-sm aria-[current=page]:bg-[var(--ui-action-soft)]"
            href={`/admin/proofs?status=${value}`}
            key={value}
          >
            {label}
          </Link>
        ))}
      </nav>
      {paginatedSubmissions.totalItems === 0 ? (
        <EmptyAdminState>No proof submissions found.</EmptyAdminState>
      ) : (
        <>
          <ProofQueue
            items={paginatedSubmissions.items.map((submission) => ({
              key: submission.key,
              title: submission.mission?.title ?? "Mission unavailable",
              learner: submission.profile?.display_name ?? "Unknown user",
            }))}
          >
            {paginatedSubmissions.items.map((submission) => (
              <AdminCard key={submission.key}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-black">
                        {submission.mission?.title ?? "Mission unavailable"}
                      </h2>
                      <AdminStatusBadge tone={proofTone(submission.status)}>
                        {submission.status.replaceAll("_", " ")}
                      </AdminStatusBadge>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-[var(--ui-text-muted)]">
                      {submission.profile?.display_name ?? "Unknown user"}
                      {submission.mission
                        ? ` · ${getMissionRewardLabel({
                            rewardType: submission.mission.reward_type,
                            rewardXp: submission.mission.reward_xp,
                            rewardTitle:
                              submission.mission.reward?.title ?? null,
                          })}`
                        : ""}
                    </p>
                    <p className="mt-1 text-xs font-bold text-[var(--ui-text-muted)]">
                      Scope: {submission.awardScope} · Submitted{" "}
                      {formatRewardDate(submission.createdAt)}
                    </p>
                    {submission.organizationId ? (
                      <p className="mt-1 text-xs font-bold text-[var(--ui-text-muted)]">
                        {submission.organizationName ?? "Organisation"}
                        {submission.programmeId
                          ? ` · ${submission.programmeName ?? "Programme"}`
                          : ""}
                      </p>
                    ) : null}
                  </div>
                </div>

                {typeof submission.mission?.presentation_config
                  ?.fullInstructions === "string" ||
                typeof submission.mission?.validation_config?.instructions ===
                  "string" ? (
                  <aside className="mt-4 rounded-xl bg-[var(--ui-action-soft)] p-4 text-sm">
                    <h3 className="font-semibold">
                      Review against these instructions
                    </h3>
                    <p className="mt-2 whitespace-pre-wrap">
                      {String(
                        submission.mission.validation_config.instructions ??
                          submission.mission.presentation_config
                            .fullInstructions,
                      )}
                    </p>
                  </aside>
                ) : null}
                <div className="mt-4 grid gap-3 border-t border-[var(--ui-border-subtle)] pt-4 md:grid-cols-2">
                  {submission.proofs.map((proof) => (
                    <div
                      className="rounded-[14px] bg-[var(--ui-surface-inset)] p-3"
                      key={proof.id}
                    >
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--ui-text-muted)]">
                        {proof.proof_type}
                      </p>
                      <ProofMedia type={proof.proof_type} value={proof.value} />
                      {proof.rejection_reason ? (
                        <p className="mt-2 text-sm text-[var(--ui-danger)]">
                          {proof.rejection_reason}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
                {submission.status === "submitted" ? (
                  <ProofDecision
                    userId={submission.userId}
                    missionId={submission.missionId}
                    awardScope={submission.awardScope}
                    returnPage={paginatedSubmissions.currentPage}
                    returnStatus={status}
                  />
                ) : null}
              </AdminCard>
            ))}
          </ProofQueue>
          <AdminPagination
            basePath="/admin/proofs"
            searchParams={{ status }}
            currentPage={paginatedSubmissions.currentPage}
            summary={`Showing ${paginatedSubmissions.startItem}-${paginatedSubmissions.endItem} of ${paginatedSubmissions.totalItems} proof submissions`}
            totalPages={paginatedSubmissions.totalPages}
          />
        </>
      )}
    </>
  );
}
