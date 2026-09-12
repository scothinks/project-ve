import Link from "next/link";
import {
  AdminBadge,
  AdminCard,
  AdminNoticeBanner,
} from "@/components/admin/AdminPrimitives";
import { ContentValueTagEditor } from "@/components/admin/ContentValueTagEditor";
import { saveCourseCompletionRules } from "@/app/admin/courses/detail-page-actions";
import { CourseForm } from "@/components/admin/LearningForms";
import { requireAdmin } from "@/lib/admin";
import { getAdminCourseDetailPageData } from "@/features/learning/admin/course-detail-data";
import { CourseDetailCompletionSection } from "@/features/learning/admin/course-detail-completion-section";
import { resolveOrganizationEntitlements } from "@/features/organizations/application/entitlements";
import { formatRewardDate } from "@/lib/rewards";
import { notFound } from "next/navigation";

type CourseSettingsPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ notice?: string }>;
};

function catalogScopeLabel(scope: string) {
  if (scope === "platform") return "Platform catalogue";
  if (scope === "organization_private") return "Organisation private";
  if (scope === "adapted_platform") return "Adapted platform course";
  return scope.replaceAll("_", " ");
}

function catalogScopeTone(scope: string) {
  if (scope === "organization_private") return "warning" as const;
  if (scope === "adapted_platform") return "info" as const;
  return "neutral" as const;
}

function workflowTone(status: string) {
  if (status === "approved" || status === "ready" || status === "published") return "good" as const;
  if (status === "changes_requested" || status === "not_ready") return "danger" as const;
  if (status === "draft" || status === "generation_ready" || status === "in_review") return "warning" as const;
  return "neutral" as const;
}

export default async function CourseSettingsPage({ params, searchParams }: CourseSettingsPageProps) {
  const { id } = await params;
  const { notice } = (await searchParams) ?? {};
  const { supabase } = await requireAdmin();
  const data = await getAdminCourseDetailPageData(supabase, id);

  if (!data) {
    notFound();
  }

  const {
    course,
    categories,
    valueDimensions,
    valueTags,
    mediaLibraryAssets,
    lessons,
    courseCompletionRules,
    completionMissionOptions,
    completionAssessmentOptions,
  } = data;
  const organizationEntitlements = course.organization_id
    ? (await resolveOrganizationEntitlements(supabase, course.organization_id)).entitlements
    : null;
  const aiGenerationAvailable = organizationEntitlements?.aiAuthoringEnabled ?? true;
  const derivedMinutes = lessons.reduce((total, lesson) => total + lesson.estimated_minutes, 0);

  return (
    <>
      <Link
        className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-[var(--ui-text-muted)] hover:text-[var(--ui-action)]"
        href={`/admin/courses/${course.id}`}
      >
        ← Back to Curriculum
      </Link>
      {notice ? <AdminNoticeBanner>{notice}</AdminNoticeBanner> : null}

      <div className="mb-6 flex flex-col gap-1">
        <span className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ui-action)]">
          Course Settings
        </span>
        <h1 className="text-[32px] font-black tracking-[-0.02em] text-[var(--ui-text)]">
          {course.title}
        </h1>
        <p className="text-sm font-medium text-[var(--ui-text-muted)]">
          Identity and completion rules for this course.
        </p>
      </div>

      <section className="mb-6 grid gap-4 xl:grid-cols-[1fr_0.75fr]">
        <AdminCard>
          <CourseForm
            aiGenerationAvailable={aiGenerationAvailable}
            categories={categories}
            course={course}
            derivedMinutes={derivedMinutes}
            mediaLibraryAssets={mediaLibraryAssets}
          />
        </AdminCard>
        <div className="space-y-4">
          <AdminCard>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ui-text-muted)]">
              Ownership scope
            </p>
            <div className="mt-3">
              <AdminBadge tone={catalogScopeTone(course.catalog_scope)}>
                {catalogScopeLabel(course.catalog_scope)}
              </AdminBadge>
            </div>
            <dl className="mt-4 space-y-3 text-sm font-semibold leading-6 text-[var(--ui-text-muted)]">
              <div>
                <dt className="text-[11px] font-black uppercase tracking-[0.14em]">Owner</dt>
                <dd className="mt-1 text-[var(--ui-text)]">
                  {course.organization_id ? `Organisation ${course.organization_id}` : "Project VE platform"}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-black uppercase tracking-[0.14em]">Version</dt>
                <dd className="mt-1 text-[var(--ui-text)]">
                  v{course.catalog_version}
                  {course.source_catalog_version ? ` · copied from source v${course.source_catalog_version}` : ""}
                </dd>
              </div>
              {course.source_course_id ? (
                <div>
                  <dt className="text-[11px] font-black uppercase tracking-[0.14em]">Source course</dt>
                  <dd className="mt-1 text-[var(--ui-text)]">{course.source_course_id}</dd>
                </div>
              ) : null}
              {course.copied_at ? (
                <div>
                  <dt className="text-[11px] font-black uppercase tracking-[0.14em]">Copied</dt>
                  <dd className="mt-1 text-[var(--ui-text)]">{formatRewardDate(course.copied_at)}</dd>
                </div>
              ) : null}
              {course.upstream_update_available ? (
                <div className="rounded-[14px] border border-[var(--ui-border-subtle)] bg-[var(--ui-surface-soft)] px-3 py-2 text-[var(--ui-text)]">
                  Source platform content has changed since this adaptation was copied.
                </div>
              ) : null}
            </dl>
          </AdminCard>
          <AdminCard>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ui-text-muted)]">
              Provenance
            </p>
            <h2 className="mt-2 text-lg font-black">
              {course.ai_generated ? "Created with AI assistance" : "Manual course"}
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <AdminBadge tone={workflowTone(course.ai_text_status)}>
                Text {course.ai_text_status.replaceAll("_", " ")}
              </AdminBadge>
              <AdminBadge tone={workflowTone(course.ai_media_status)}>
                Media {course.ai_media_status.replaceAll("_", " ")}
              </AdminBadge>
            </div>
          </AdminCard>
          <CourseDetailCompletionSection
            action={saveCourseCompletionRules}
            assessments={completionAssessmentOptions}
            course={course}
            lessons={lessons}
            missions={completionMissionOptions}
            quizzes={data.quizRows}
            rules={courseCompletionRules}
          />
        </div>
      </section>

      <AdminCard className="mb-6">
        <ContentValueTagEditor
          contentId={course.id}
          contentType="course"
          dimensions={valueDimensions}
          redirectTo={`/admin/courses/${course.id}/settings`}
          tags={valueTags}
        />
      </AdminCard>

      <div className="mt-6 space-y-3" id="media">
        <Link href={`/admin/courses/${course.id}/review#course-artwork`} className="block font-bold underline">Course thumbnail and cover</Link>
        <Link href={`/admin/courses/${course.id}/media`} className="block font-bold underline">Earlier media and pending requests</Link>
        <p className="text-sm">Edit lesson images and media in their page blocks. Your earlier briefs and assets remain available.</p>
      </div>
    </>
  );
}
