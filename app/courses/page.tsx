import { CourseLibrary } from "@/components/course/CourseLibrary";
import { AppHeader } from "@/components/navigation/AppHeader";
import { BottomNav } from "@/components/navigation/BottomNav";
import { SectionHeader } from "@/components/ui/SectionHeader";
import {
  getCompletedLessonIds,
  getLessonProgress,
  type LessonProgressRecord,
} from "@/lib/progress";
import { getCachedLearningCourseSummaries } from "@/lib/supabase-learning";
import {
  createSupabaseServerClient,
  getCurrentUserProfile,
  hasSupabaseAuthCookies,
} from "@/lib/supabase-server";
import { isSupabaseConfigured } from "@/lib/supabase";

export default async function CoursesPage() {
  const [catalog, hasAuthCookies] = await Promise.all([
    getCachedLearningCourseSummaries(),
    hasSupabaseAuthCookies(),
  ]);
  let lessonProgress: LessonProgressRecord[] = [];

  if (isSupabaseConfigured && hasAuthCookies) {
    const supabase = await createSupabaseServerClient();
    const { user } = await getCurrentUserProfile(supabase);
    lessonProgress = user && supabase ? await getLessonProgress(supabase, user.id) : [];
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
