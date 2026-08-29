import { CourseLibrary } from "@/components/course/CourseLibrary";
import { BottomNav } from "@/components/navigation/BottomNav";
import { LearnerTopChrome } from "@/components/navigation/LearnerTopChrome";
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
import { measureAsync } from "@/lib/performance";

export default async function CoursesPage() {
  const supabase = await createSupabaseServerClient();
  const learningRepository = createLearningRepository(supabase);
  const progressRepository = createProgressRepository(supabase);
  const [catalog, hasAuthCookies] = await Promise.all([
    measureAsync("courses.learning_course_cards", () => learningRepository.getCourseCards()),
    hasSupabaseAuthCookies(),
  ]);
  let lessonProgress: LessonProgressRecord[] = [];
  let displayName = "Learner";
  let email: string | null | undefined;
  let avatarUrl: string | null | undefined;

  if (isDemoMode) {
    lessonProgress = await progressRepository.getLessonProgress(DEMO_USER_ID);
  } else if (isLiveMode && hasAuthCookies) {
    const { user, profile } = await getCurrentUserProfile(supabase);
    const rawDisplayName = profile?.display_name ?? "";
    displayName = rawDisplayName && !rawDisplayName.includes("@") ? rawDisplayName : "Learner";
    email = user?.email;
    avatarUrl = profile?.avatar_url;
    lessonProgress = user ? await progressRepository.getLessonProgress(user.id) : [];
  }

  const completedLessonIds = Array.from(
    getCompletedLessonIds(
      lessonProgress,
      catalog.flatMap((course) => course.lessons),
    ),
  );

  return (
    <main className="learner-system courses-learner min-h-screen">
      <LearnerTopChrome
        active="Lessons"
        avatarUrl={avatarUrl}
        displayName={displayName}
        email={email}
      />
      <section className="courses-canvas">
        <h1 className="sr-only">Course Library</h1>
        <CourseLibrary
          completedLessonIds={completedLessonIds}
          courses={catalog}
          lessonProgress={lessonProgress}
          variant="learnerEditorial"
        />
      </section>
      <div className="learner-mobile-nav">
        <BottomNav active="Lesson" />
      </div>
    </main>
  );
}
