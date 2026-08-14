import { NextRequest, NextResponse } from "next/server";
import { getAdminLmsReporting, requireAdmin } from "@/lib/admin";

function csvCell(value: unknown) {
  const raw = value === null || value === undefined ? "" : String(value);
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll("\"", "\"\"")}"`;
}

function firstParam(params: URLSearchParams, key: string) {
  const value = params.get(key);
  return value && value !== "all" ? value : null;
}

export async function GET(request: NextRequest) {
  const { supabase } = await requireAdmin();
  const params = request.nextUrl.searchParams;
  const report = await getAdminLmsReporting(supabase, {
    cohortId: firstParam(params, "cohortId"),
    limit: 500,
    organizationId: firstParam(params, "organizationId"),
    programmeId: firstParam(params, "programmeId"),
    unitId: firstParam(params, "unitId"),
  });
  const header = [
    "user_id",
    "display_name",
    "cohorts",
    "assigned_count",
    "started_count",
    "completed_count",
    "overdue_count",
    "average_course_progress",
    "average_programme_progress",
    "average_quiz_score",
    "mission_awards",
    "reward_redemptions",
    "last_activity_at",
  ];
  const rows = report.learners.map((learner) => [
    learner.userId,
    learner.displayName ?? "",
    learner.cohorts.map((cohort) => cohort.title).join("; "),
    learner.assignedCount,
    learner.startedCount,
    learner.completedCount,
    learner.overdueCount,
    learner.averageCourseProgress,
    learner.averageProgrammeProgress,
    learner.averageQuizScore,
    learner.missionAwards,
    learner.rewardRedemptions,
    learner.lastActivityAt ?? "",
  ]);
  const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="project-ve-lms-reporting-${date}.csv"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
