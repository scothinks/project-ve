import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CourseDetailLessonList } from "@/components/course/CourseDetailLessonList";
import { AppHeader } from "@/components/navigation/AppHeader";
import { BottomNav } from "@/components/navigation/BottomNav";
import { Card } from "@/components/ui/Card";
import { XPBadge } from "@/components/ui/XPBadge";
import { createProgressRepository } from "@/features/app/repositories/progress";
import {
  appendOrganizationDeliverySearchParam,
  getOrganizationCourseDeliveryContext,
  getOrganizationWorkspaceCourse,
} from "@/features/organizations/application/learner-workspace";
import { getImageFitClass, getImagePresentationStyle } from "@/lib/image-presentation";
import { getCourseXP } from "@/lib/lessons";
import {
  getCompletedLessonIds,
  getCourseProgress,
  getCourseResumeTarget,
} from "@/lib/progress";
import { orgHref, requireOrgLearnerRoute } from "@/app/o/[organizationSlug]/workspace";

type OrgCourseDetailPageProps = {
  params: Promise<{ courseId: string; organizationSlug: string }>;
  searchParams: Promise<{ programmeId?: string }>;
};

export default async function OrganizationCourseDetailPage({ params, searchParams }: OrgCourseDetailPageProps) {
  const resolvedParams = await params;
  const { programmeId } = await searchParams;
  const { supabase, user, workspace } = await requireOrgLearnerRoute(Promise.resolve({
    organizationSlug: resolvedParams.organizationSlug,
  }));
  const course = await getOrganizationWorkspaceCourse(supabase, workspace, resolvedParams.courseId);
  const deliveryContext = getOrganizationCourseDeliveryContext(workspace, resolvedParams.courseId, programmeId);

  if (!course || !deliveryContext) {
    notFound();
  }

  const lessonProgress = await createProgressRepository(supabase).getLessonProgress(user.id);
  const completedLessonIds = getCompletedLessonIds(lessonProgress, course.lessons);
  const completedLessonIdList = Array.from(completedLessonIds);
  const { progressPercent } = getCourseProgress(course, completedLessonIds);
  const resumeTarget = getCourseResumeTarget(course, lessonProgress, completedLessonIds, {
    lessonHref: (lessonId, pageNumber) => {
      const href = orgHref(workspace, `/learn/${course.id}/lessons/${lessonId}`);
      const pagedHref = pageNumber ? `${href}?page=${pageNumber}` : href;
      return appendOrganizationDeliverySearchParam(pagedHref, deliveryContext);
    },
    quizHref: (lessonId) => appendOrganizationDeliverySearchParam(
      orgHref(workspace, `/learn/${course.id}/quiz/${lessonId}`),
      deliveryContext,
    ),
  });
  const heroImage = course.coverImage ?? course.thumbnail;
  const organizationName = workspace.branding.shortName || workspace.branding.name;

  return (
    <main className="mobile-shell min-h-screen bg-[var(--ve-card)]">
      <AppHeader title={course.title} backHref={orgHref(workspace, "/learn")} showMenu={false} />
      <section className="learner-page learner-page--spacious">
        <div className="mb-4">
          <Link className="text-sm font-black text-[var(--ve-green)]" href="/courses">
            Return to Project Ve
          </Link>
        </div>
        <div className="learner-content-grid">
          <div className="space-y-6">
            <Card className="overflow-hidden">
              <div className="relative h-44 w-full lg:h-64">
                <Image
                  alt={heroImage.alt}
                  className={getImageFitClass(heroImage)}
                  fill
                  sizes="(max-width: 768px) 100vw, 720px"
                  src={heroImage.src}
                  style={getImagePresentationStyle(heroImage)}
                />
              </div>
              <div className="p-6">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-green)]">
                  {organizationName}
                </p>
                <h1 className="mt-2 text-3xl font-black leading-tight text-[var(--foreground)]">
                  {course.title}
                </h1>
                <p className="mt-3 text-sm font-semibold leading-6 text-[var(--ve-muted-strong)]">
                  {course.description}
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <XPBadge xp={getCourseXP(course)} />
                  <span className="rounded-full bg-[var(--ve-panel)] px-3 py-1 text-xs font-black text-[var(--ve-muted)]">
                    {progressPercent}% complete
                  </span>
                  <span className="rounded-full bg-[var(--ve-panel)] px-3 py-1 text-xs font-black text-[var(--ve-muted)]">
                    {course.estimatedMinutes} min
                  </span>
                </div>
                {resumeTarget ? (
                  <Link
                    className="mt-5 inline-flex h-11 items-center rounded-[14px] bg-[var(--ve-green)] px-5 text-sm font-black text-white"
                    href={resumeTarget.href}
                  >
                    {resumeTarget.label}
                  </Link>
                ) : null}
              </div>
            </Card>
          </div>
          <div>
            <h2 className="text-lg font-black tracking-[-0.02em] text-[var(--foreground)]">
              Lessons
            </h2>
            <div className="mt-3">
              <CourseDetailLessonList
                completedLessonIds={completedLessonIdList}
                lessonHrefBase={orgHref(workspace, `/learn/${course.id}/lessons`)}
                lessonHrefSuffix={deliveryContext.programmeId ? `?programmeId=${encodeURIComponent(deliveryContext.programmeId)}` : ""}
                lessons={course.lessons}
              />
            </div>
          </div>
        </div>
      </section>
      <BottomNav active="Lesson" />
    </main>
  );
}
