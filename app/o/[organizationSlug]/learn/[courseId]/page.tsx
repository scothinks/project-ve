import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  OrgActionLink,
  OrgBottomNav,
  OrgLearnerChrome,
  OrgProgressMeter,
} from "@/components/organizations/OrgLearnerMobile";
import { CheckIcon, LockIcon, PlayIcon } from "@/components/organizations/OrgIcons";
import { LearnerWorkspaceSwitcher } from "@/components/navigation/LearnerWorkspaceSwitcher";
import { createProgressRepository } from "@/features/app/repositories/progress";
import {
  appendOrganizationDeliverySearchParam,
  getOrganizationCourseDeliveryContext,
  getOrganizationDeliveryLessonProgress,
  getOrganizationWorkspaceCourse,
} from "@/features/organizations/application/learner-workspace";
import { getMyOrganizationState } from "@/features/organizations/application/my-orgs";
import { getImageFitClass, getImagePresentationStyle } from "@/lib/image-presentation";
import {
  getCompletedLessonIds,
  getCourseProgress,
  getCourseResumeTarget,
} from "@/lib/progress";
import { orgHref, requireOrgLearnerRoute } from "@/app/o/[organizationSlug]/workspace";
import { formatXpLabel } from "@/lib/xp-format";
import { getLessonXP } from "@/lib/lessons";

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

  const [globalLessonProgress, myOrgsState] = await Promise.all([
    createProgressRepository(supabase).getLessonProgress(user.id),
    getMyOrganizationState(supabase, user.id),
  ]);
  const lessonProgress = await getOrganizationDeliveryLessonProgress({
    course,
    deliveryContext,
    fallbackProgress: globalLessonProgress,
    supabase,
    userId: user.id,
  });
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
  const upNextLesson = course.lessons.find(
    (lesson) => !completedLessonIds.has(lesson.id) && lesson.status !== "locked",
  );

  return (
    <main className="learner-system orgs-learner min-h-screen">
      <OrgLearnerChrome
        active="Lessons"
        balance={workspace.xpAccount.balance}
        logoUrl={workspace.branding.logoUrl}
        organizationName={organizationName}
        organizationSlug={workspace.organizationSlug}
        pointsLabel={workspace.xpAccount.label}
        workspaceSwitcher={
          <LearnerWorkspaceSwitcher
            currentOrganizationSlug={workspace.organizationSlug}
            organizations={myOrgsState.organizations}
          />
        }
      />
      <section className="learner-page learner-page--standard">
        <article className="org-course-detail">
          <div className="org-course-detail__hero relative h-36 w-full overflow-hidden rounded-lg bg-[var(--learner-surface-soft)]">
            <Image
              alt={heroImage.alt}
              className={getImageFitClass(heroImage)}
              fill
              priority
              sizes="(max-width: 430px) 100vw, 430px"
              src={heroImage.src}
              style={getImagePresentationStyle(heroImage)}
            />
            <span className="absolute bottom-2 left-2 rounded-full bg-[var(--learner-green-deep)] px-2.5 py-1 text-[0.58rem] font-extrabold text-white">
              {deliveryContext.label}
            </span>
          </div>
          <div className="org-course-detail__body pt-4">
            <p className="inline-flex rounded border border-[var(--learner-border-soft)] bg-[var(--learner-surface)] px-2 py-1 text-[0.58rem] font-bold uppercase tracking-[0.06em] text-[var(--learner-text-muted)]">
              Course
            </p>
            <h1 className="mt-3 text-[1.08rem] font-[650] leading-5 text-[var(--learner-text)]">
              {course.title}
            </h1>
            <p className="mt-2 text-[0.72rem] font-medium leading-5 text-[var(--learner-text-muted)]">
              {course.description}
            </p>
            <div className="org-mobile-card org-course-detail__progress relative mt-4 overflow-hidden p-3 pb-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <span className="block text-[0.68rem] font-semibold text-[var(--learner-text-muted)]">
                    Your Progress
                  </span>
                  <p className="mt-1 text-[0.72rem] font-medium text-[var(--learner-text)]">
                    {completedLessonIdList.length} of {course.lessons.length} lessons completed
                  </p>
                </div>
                <span className="text-[1.1rem] font-[650] leading-none text-[var(--learner-green-deep)]">
                  {progressPercent}%
                </span>
              </div>
              <OrgProgressMeter flush value={progressPercent} />
            </div>
            {resumeTarget ? (
              <div className="mt-4">
                <OrgActionLink className="w-full" href={resumeTarget.href}>
                  {resumeTarget.label}
                </OrgActionLink>
              </div>
            ) : null}
          </div>
        </article>

        <section className="org-course-syllabus mt-6">
          <h2 className="text-[0.9rem] font-[650] text-[var(--learner-text)]">Syllabus</h2>
          <div className="mt-3">
            {course.lessons.map((lesson, index) => {
              const completed = completedLessonIds.has(lesson.id);
              const locked = lesson.status === "locked";
              const upNext = upNextLesson?.id === lesson.id;
              const isLast = index === course.lessons.length - 1;
              const href = `${orgHref(workspace, `/learn/${course.id}/lessons/${lesson.id}`)}${
                deliveryContext.programmeId ? `?programmeId=${encodeURIComponent(deliveryContext.programmeId)}` : ""
              }`;

              return (
                <Link
                  aria-disabled={locked}
                  className={`grid grid-cols-[1.5rem_minmax(0,1fr)] gap-3 ${
                    locked ? "pointer-events-none opacity-[0.62] grayscale" : ""
                  }`}
                  href={locked ? "#" : href}
                  key={lesson.id}
                >
                  <span className="flex flex-col items-center">
                    <span
                      className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-[0.58rem] font-extrabold ${
                        completed
                          ? "bg-[var(--learner-green-deep)] text-white"
                          : upNext
                            ? "bg-[var(--learner-green-deep)] text-white ring-4 ring-[color:color-mix(in_srgb,var(--learner-green)_20%,transparent)]"
                            : locked
                              ? "border border-[var(--learner-border)] text-[var(--learner-text-muted)]"
                              : "border border-[var(--learner-border)] text-[var(--learner-text-muted)]"
                      }`}
                    >
                      {completed ? (
                        <CheckIcon className="size-3" />
                      ) : upNext ? (
                        <PlayIcon className="size-3" />
                      ) : locked ? (
                        <LockIcon className="size-3" />
                      ) : (
                        index + 1
                      )}
                    </span>
                    {!isLast ? (
                      <span className="my-0.5 w-px flex-1 bg-[color:color-mix(in_srgb,var(--learner-border)_60%,transparent)]" />
                    ) : null}
                  </span>
                  <span className="min-w-0 pb-4">
                    <span className="block text-[0.68rem] font-[650] leading-4 text-[var(--learner-green-deep)]">
                      Lesson {index + 1} - {completed ? "Completed" : upNext ? "Up Next" : locked ? "Locked" : "Lesson"}
                    </span>
                    <span className="mt-1 block text-[0.74rem] font-[650] leading-4 text-[var(--learner-text)]">
                      {lesson.title}
                    </span>
                    <span className="mt-1 line-clamp-2 block text-[0.62rem] font-medium leading-4 text-[var(--learner-text-muted)]">
                      {lesson.summary}
                    </span>
                    <span className="mt-2 block text-[0.58rem] font-semibold text-[var(--learner-text-muted)]">
                      {lesson.estimatedMinutes} min · {formatXpLabel(getLessonXP(lesson), workspace.xpAccount.label)}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      </section>
      <OrgBottomNav active="Lessons" organizationSlug={workspace.organizationSlug} />
    </main>
  );
}
