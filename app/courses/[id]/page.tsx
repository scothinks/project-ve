import { notFound } from "next/navigation";
import Image from "next/image";
import { DirectAdCard } from "@/components/ads/DirectAdCard";
import { CourseDetailLessonList } from "@/components/course/CourseDetailLessonList";
import { AppHeader } from "@/components/navigation/AppHeader";
import { BottomNav } from "@/components/navigation/BottomNav";
import { LearnerTopChrome } from "@/components/navigation/LearnerTopChrome";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { XPBadge } from "@/components/ui/XPBadge";
import { createLearningRepository } from "@/features/app/repositories/learning";
import { createProgressRepository } from "@/features/app/repositories/progress";
import { withLoggedFallback } from "@/lib/app-errors";
import { isDemoMode, isLiveMode } from "@/lib/app-mode";
import { getImageFitClass, getImagePresentationStyle } from "@/lib/image-presentation";
import { getCourseXP } from "@/lib/lessons";
import {
  getCompletedLessonIds,
  getCourseProgress,
  getCourseResumeTarget,
} from "@/lib/progress";
import { createSupabaseServerClient, getCurrentUserProfile } from "@/lib/supabase-server";
import { getAdContentValueTags, getAdDecision, getLearnerAdSegments } from "@/lib/ads";
import { DEMO_USER_ID } from "@/lib/demo-progress-store";

type CourseDetailPageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export default async function CourseDetailPage({ params }: CourseDetailPageProps) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { user, profile } = await getCurrentUserProfile(supabase);
  const rawDisplayName = profile?.display_name ?? "";
  const displayName = rawDisplayName && !rawDisplayName.includes("@") ? rawDisplayName : "Learner";
  const learningRepository = createLearningRepository(supabase);
  const progressRepository = createProgressRepository(supabase);
  const course = await learningRepository.getCourse(id);

  if (!course) {
    notFound();
  }

  const [lessonProgress, contentValueTags, segmentKeys] = await Promise.all([
    isDemoMode
      ? progressRepository.getLessonProgress(DEMO_USER_ID)
      : isLiveMode && user
        ? progressRepository.getLessonProgress(user.id)
        : Promise.resolve([]),
    withLoggedFallback({
      context: {
        operation: "course.ads.content_value_tags",
        resourceId: course.id,
        userId: user?.id,
      },
      fallback: [],
      promise: getAdContentValueTags(supabase, { courseId: course.id }),
    }),
    withLoggedFallback({
      context: {
        operation: "course.ads.segments",
        resourceId: course.id,
        userId: user?.id,
      },
      fallback: [],
      promise: getLearnerAdSegments(supabase, user?.id),
    }),
  ]);
  const completedLessonIds = getCompletedLessonIds(lessonProgress, course.lessons);
  const completedLessonIdList = Array.from(completedLessonIds);
  const { progressPercent } = getCourseProgress(course, completedLessonIds);
  const resumeTarget = getCourseResumeTarget(course, lessonProgress, completedLessonIds);
  const heroImage = course.coverImage ?? course.thumbnail;
  const courseDetailAd = await getAdDecision(supabase, {
    placementKey: "course_detail_card",
    route: `/courses/${course.id}`,
    userId: user?.id,
    courseId: course.id,
    courseCategory: course.category,
    contentValueTags,
    segmentKeys,
  });

  return (
    <main className="mobile-shell min-h-screen bg-[var(--ve-card)]">
      <div className="hidden lg:block">
        <LearnerTopChrome
          active="Lessons"
          avatarUrl={profile?.avatar_url}
          displayName={displayName}
          email={user?.email}
        />
      </div>
      <AppHeader title={course.title} backHref="/courses" showMenu={false} />
      <section className="learner-page learner-page--spacious">
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
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#008751]">
                      {course.category}
                    </p>
                    <h1 className="mt-2 text-2xl font-black leading-8">{course.title}</h1>
                  </div>
                  <XPBadge className="shrink-0" xp={getCourseXP(course)} />
                </div>
                <p className="mt-3 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
                  {course.description}
                </p>
                <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-[18px] bg-[var(--ve-card-muted)] p-3">
                    <p className="text-[10px] font-bold uppercase text-[var(--ve-muted)]">Level</p>
                    <p className="mt-1 text-xs font-black capitalize text-[var(--foreground)]">{course.level}</p>
                  </div>
                  <div className="rounded-[18px] bg-[var(--ve-card-muted)] p-3">
                    <p className="text-[10px] font-bold uppercase text-[var(--ve-muted)]">Time</p>
                    <p className="mt-1 text-xs font-black text-[var(--foreground)]">{course.estimatedMinutes}m</p>
                  </div>
                  <div className="rounded-[18px] bg-[var(--ve-card-muted)] p-3">
                    <p className="text-[10px] font-bold uppercase text-[var(--ve-muted)]">Lessons</p>
                    <p className="mt-1 text-xs font-black text-[var(--foreground)]">{course.lessons.length}</p>
                  </div>
                </div>
                <div className="mt-5 h-2 rounded-full bg-[var(--ve-line-soft)]">
                  <div
                    className="h-full rounded-full bg-[#008751]"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                {resumeTarget ? (
                  <Button className="mt-5 w-full" href={resumeTarget.href}>
                    {resumeTarget.label}
                  </Button>
                ) : null}
              </div>
            </Card>

            <div className="lg:hidden">
              <DirectAdCard ad={courseDetailAd} />
            </div>

            <section>
              <h2 className="text-[17px] font-bold">Lessons</h2>
              {course.lessons.length === 0 ? (
                <Card className="mt-3 rounded-[18px] border border-dashed border-[var(--ve-line-soft)] bg-[var(--ve-card-muted)] p-5">
                  <p className="text-sm font-black">No lessons currently.</p>
                  <p className="mt-2 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
                    This course is live, but the lessons are still being reviewed. Check back soon.
                  </p>
                </Card>
              ) : (
                <div className="mt-3">
                  <CourseDetailLessonList
                    completedLessonIds={completedLessonIdList}
                    lessons={course.lessons}
                  />
                </div>
              )}
            </section>
          </div>
          <aside className="hidden space-y-4 lg:block">
            <DirectAdCard ad={courseDetailAd} />
            <Card className="p-5">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--ve-muted)]">
                Course progress
              </p>
              <p className="mt-2 text-2xl font-black tracking-[-0.03em]">
                {Math.round(progressPercent)}%
              </p>
              <p className="mt-2 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
                Continue from the next available lesson when you are ready.
              </p>
            </Card>
          </aside>
        </div>
      </section>
      <div className="learner-mobile-nav">
        <BottomNav active="Lesson" />
      </div>
    </main>
  );
}
