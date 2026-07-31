import { CourseLibrary } from "@/components/course/CourseLibrary";
import { AppHeader } from "@/components/navigation/AppHeader";
import { BottomNav } from "@/components/navigation/BottomNav";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { createLearningRepository } from "@/features/app/repositories/learning";
import { createProgressRepository } from "@/features/app/repositories/progress";
import {
  getCompletedLessonIds,
  type LessonProgressRecord,
} from "@/lib/progress";
import {
  createSupabaseServerClient,
  getCurrentUserProfile,
  hasSupabaseAuthCookies,
} from "@/lib/supabase-server";
import { isDemoMode, isLiveMode } from "@/lib/app-mode";
import { DEMO_USER_ID } from "@/lib/demo-progress-store";

export default async function CoursesPage() {
  const supabase = await createSupabaseServerClient();
  const learningRepository = createLearningRepository(supabase);
  const progressRepository = createProgressRepository(supabase);
  const [catalog, hasAuthCookies] = await Promise.all([
    learningRepository.getCourseSummaries(),
    hasSupabaseAuthCookies(),
  ]);
  let lessonProgress: LessonProgressRecord[] = [];

  if (isDemoMode) {
    lessonProgress = await progressRepository.getLessonProgress(DEMO_USER_ID);
  } else if (isLiveMode && hasAuthCookies) {
    const { user } = await getCurrentUserProfile(supabase);
    lessonProgress = user ? await progressRepository.getLessonProgress(user.id) : [];
  }

  const completedLessonIds = Array.from(
    getCompletedLessonIds(
      lessonProgress,
      catalog.flatMap((course) => course.lessons),
    ),
  );

  return (
    <main className="mobile-shell min-h-screen">
      <AppHeader title="Course Library" backHref="/dashboard" showMenu={false} />
      <section className="learner-page learner-page--standard">
        <SectionHeader
          eyebrow="Discover"
          subtitle="Search the Project VE library."
        />
        <div className="mt-5">
          <CourseLibrary completedLessonIds={completedLessonIds} courses={catalog} />
        </div>
      </section>
      <BottomNav active="Lesson" />
    </main>
  );
}
