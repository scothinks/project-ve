import Link from "next/link";
import {
  AdminCard,
  AdminPageHeader,
  AdminStatCard,
  AdminTable,
  EmptyAdminState,
  adminButtonClasses,
} from "@/components/admin/AdminPrimitives";
import {
  getAdminCohorts,
  getAdminLmsReporting,
  getAdminOrganizations,
  getAdminProgrammes,
  requireAdmin,
} from "@/lib/admin";
import { formatRewardDate } from "@/lib/rewards";

type ReportingSearchParams = {
  cohortId?: string | string[];
  organizationId?: string | string[];
  programmeId?: string | string[];
};

function firstSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function percent(value: number) {
  return `${Math.round(value)}%`;
}

function selectedOrEmpty(value: string | undefined) {
  return value && value !== "all" ? value : "";
}

export default async function AdminLmsReportingPage({
  searchParams,
}: {
  searchParams?: Promise<ReportingSearchParams>;
}) {
  const { supabase } = await requireAdmin();
  const params = (await searchParams) ?? {};
  const [organizations, programmes, cohorts] = await Promise.all([
    getAdminOrganizations(supabase),
    getAdminProgrammes(supabase),
    getAdminCohorts(supabase),
  ]);
  const requestedOrganizationId = selectedOrEmpty(firstSearchValue(params.organizationId));
  const selectedOrganizationId =
    requestedOrganizationId || (organizations.length === 1 ? organizations[0]?.id ?? "" : "");
  const selectedProgrammeId = selectedOrEmpty(firstSearchValue(params.programmeId));
  const selectedCohortId = selectedOrEmpty(firstSearchValue(params.cohortId));
  const filteredProgrammes = selectedOrganizationId
    ? programmes.filter((programme) => programme.organization_id === selectedOrganizationId)
    : programmes;
  const filteredCohorts = selectedOrganizationId
    ? cohorts.filter((cohort) => cohort.organization_id === selectedOrganizationId)
    : cohorts;
  const report = await getAdminLmsReporting(supabase, {
    cohortId: selectedCohortId || null,
    limit: 100,
    organizationId: selectedOrganizationId || null,
    programmeId: selectedProgrammeId || null,
  });
  const exportParams = new URLSearchParams();

  if (selectedOrganizationId) exportParams.set("organizationId", selectedOrganizationId);
  if (selectedProgrammeId) exportParams.set("programmeId", selectedProgrammeId);
  if (selectedCohortId) exportParams.set("cohortId", selectedCohortId);

  const exportHref = `/admin/reporting/export${exportParams.size > 0 ? `?${exportParams.toString()}` : ""}`;

  return (
    <>
      <AdminPageHeader
        backHref="/admin"
        backLabel="Admin overview"
        eyebrow="Reporting"
        title="LMS reporting"
        subtitle="Track programme, cohort and learner outcomes across assignments, completion, quizzes, missions and rewards."
      />

      <AdminCard className="mb-5">
        <form className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_auto_auto]">
          <label>
            <span className="text-xs font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]">
              Organisation
            </span>
            <select
              className="mt-1 w-full rounded-[12px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 py-2 text-sm font-semibold outline-none focus:border-[var(--ve-green)]"
              defaultValue={selectedOrganizationId || "all"}
              name="organizationId"
            >
              <option value="all">All organisations</option>
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="text-xs font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]">
              Programme
            </span>
            <select
              className="mt-1 w-full rounded-[12px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 py-2 text-sm font-semibold outline-none focus:border-[var(--ve-green)]"
              defaultValue={selectedProgrammeId || "all"}
              name="programmeId"
            >
              <option value="all">All programmes</option>
              {filteredProgrammes.map((programme) => (
                <option key={programme.id} value={programme.id}>
                  {programme.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="text-xs font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]">
              Cohort
            </span>
            <select
              className="mt-1 w-full rounded-[12px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 py-2 text-sm font-semibold outline-none focus:border-[var(--ve-green)]"
              defaultValue={selectedCohortId || "all"}
              name="cohortId"
            >
              <option value="all">All cohorts</option>
              {filteredCohorts.map((cohort) => (
                <option key={cohort.id} value={cohort.id}>
                  {cohort.title}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button className={adminButtonClasses("primary", "w-full")} type="submit">
              Apply
            </button>
          </div>
          <div className="flex items-end">
            <Link className={adminButtonClasses("secondary", "w-full")} href={exportHref}>
              Export CSV
            </Link>
          </div>
        </form>
      </AdminCard>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard label="Assigned learners" value={report.summary.assignedLearners} />
        <AdminStatCard label="In progress" tone="warning" value={report.summary.inProgressLearners} />
        <AdminStatCard label="Completed" tone="mission" value={report.summary.completedLearners} />
        <AdminStatCard label="Overdue" tone="risk" value={report.summary.overdueLearners} />
      </section>

      <section className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard label="Avg course progress" value={percent(report.summary.averageCourseProgress)} />
        <AdminStatCard label="Avg programme progress" value={percent(report.summary.averageProgrammeProgress)} />
        <AdminStatCard label="Avg quiz score" tone="store" value={percent(report.summary.averageQuizScore)} />
        <AdminStatCard label="Reward usage" tone="store" value={report.summary.rewardRedemptions} />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <div>
          <h2 className="mb-3 text-lg font-black">Learner detail</h2>
          {report.learners.length === 0 ? (
            <EmptyAdminState>No learner reporting rows match these filters.</EmptyAdminState>
          ) : (
            <AdminTable columns={["Learner", "Cohorts", "Assigned", "Completed", "Overdue", "Progress", "Quiz", "Engagement", "Last activity"]}>
              {report.learners.map((learner) => (
                <tr key={learner.userId}>
                  <td className="min-w-[220px] px-4 py-4">
                    <p className="font-black">{learner.displayName ?? "Unnamed learner"}</p>
                    <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">{learner.userId}</p>
                  </td>
                  <td className="min-w-[180px] px-4 py-4 text-xs font-bold text-[var(--ve-muted-strong)]">
                    {learner.cohorts.length > 0
                      ? learner.cohorts.map((cohort) => cohort.title).join(", ")
                      : "No active cohort"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 font-black tabular-nums">{learner.assignedCount}</td>
                  <td className="whitespace-nowrap px-4 py-4 font-black tabular-nums">{learner.completedCount}</td>
                  <td className="whitespace-nowrap px-4 py-4 font-black tabular-nums">{learner.overdueCount}</td>
                  <td className="whitespace-nowrap px-4 py-4 text-sm font-bold">
                    {percent(Math.max(learner.averageCourseProgress, learner.averageProgrammeProgress))}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-sm font-bold">{percent(learner.averageQuizScore)}</td>
                  <td className="whitespace-nowrap px-4 py-4 text-sm font-bold">
                    {learner.missionAwards} missions · {learner.rewardRedemptions} rewards
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-sm font-bold">
                    {learner.lastActivityAt ? formatRewardDate(learner.lastActivityAt) : "No activity"}
                  </td>
                </tr>
              ))}
            </AdminTable>
          )}
        </div>

        <div>
          <h2 className="mb-3 text-lg font-black">Cohort comparison</h2>
          {report.cohortComparison.length === 0 ? (
            <EmptyAdminState>No cohorts match these filters.</EmptyAdminState>
          ) : (
            <AdminTable columns={["Cohort", "Assigned", "Done", "Overdue", "Avg"]}>
              {report.cohortComparison.map((cohort) => (
                <tr key={cohort.cohortId}>
                  <td className="min-w-[180px] px-4 py-4 font-black">{cohort.title}</td>
                  <td className="whitespace-nowrap px-4 py-4 font-black tabular-nums">{cohort.assignedLearners}</td>
                  <td className="whitespace-nowrap px-4 py-4 font-black tabular-nums">{cohort.completedLearners}</td>
                  <td className="whitespace-nowrap px-4 py-4 font-black tabular-nums">{cohort.overdueLearners}</td>
                  <td className="whitespace-nowrap px-4 py-4 text-sm font-bold">{percent(cohort.averageProgress)}</td>
                </tr>
              ))}
            </AdminTable>
          )}
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-3">
        <div>
          <h2 className="mb-3 text-lg font-black">Quiz scores</h2>
          {report.quizScores.length === 0 ? (
            <EmptyAdminState>No quiz attempts yet.</EmptyAdminState>
          ) : (
            <AdminTable columns={["Quiz", "Attempts", "Average"]}>
              {report.quizScores.map((quiz) => (
                <tr key={quiz.quizId}>
                  <td className="min-w-[180px] px-4 py-4 font-black">{quiz.title}</td>
                  <td className="whitespace-nowrap px-4 py-4 font-black tabular-nums">{quiz.attempts}</td>
                  <td className="whitespace-nowrap px-4 py-4 text-sm font-bold">{percent(quiz.averageScore)}</td>
                </tr>
              ))}
            </AdminTable>
          )}
        </div>
        <div>
          <h2 className="mb-3 text-lg font-black">Mission completion</h2>
          {report.missionCompletion.length === 0 ? (
            <EmptyAdminState>No mission completion yet.</EmptyAdminState>
          ) : (
            <AdminTable columns={["Mission", "Awards", "Rate"]}>
              {report.missionCompletion.map((mission) => (
                <tr key={mission.missionId}>
                  <td className="min-w-[180px] px-4 py-4 font-black">{mission.title}</td>
                  <td className="whitespace-nowrap px-4 py-4 font-black tabular-nums">{mission.awards}</td>
                  <td className="whitespace-nowrap px-4 py-4 text-sm font-bold">{percent(mission.completionRate)}</td>
                </tr>
              ))}
            </AdminTable>
          )}
        </div>
        <div>
          <h2 className="mb-3 text-lg font-black">Reward usage</h2>
          {report.rewardUsage.length === 0 ? (
            <EmptyAdminState>No reward redemptions yet.</EmptyAdminState>
          ) : (
            <AdminTable columns={["Reward", "Total", "Fulfilled"]}>
              {report.rewardUsage.map((reward) => (
                <tr key={reward.rewardId}>
                  <td className="min-w-[180px] px-4 py-4 font-black">{reward.title}</td>
                  <td className="whitespace-nowrap px-4 py-4 font-black tabular-nums">{reward.redemptions}</td>
                  <td className="whitespace-nowrap px-4 py-4 text-sm font-bold">{reward.fulfilled}</td>
                </tr>
              ))}
            </AdminTable>
          )}
        </div>
      </section>
    </>
  );
}
