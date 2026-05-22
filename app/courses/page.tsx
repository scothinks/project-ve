import { CourseLibrary } from "@/components/course/CourseLibrary";
import { AppHeader } from "@/components/navigation/AppHeader";
import { BottomNav } from "@/components/navigation/BottomNav";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getCompletedLessonIds, getLessonProgress } from "@/lib/progress";
import { getLearningCatalog } from "@/lib/supabase-learning";
import { createSupabaseServerClient, getCurrentUserProfile } from "@/lib/supabase-server";
import { isSupabaseConfigured } from "@/lib/supabase";

export default async function CoursesPage() {
  const [{ user }, supabase] = await Promise.all([
    getCurrentUserProfile(),
    createSupabaseServerClient(),
  ]);
  const catalog = await getLearningCatalog(supabase);
  const lessonProgress =
    isSupabaseConfigured && user && supabase ? await getLessonProgress(supabase, user.id) : [];
  const completedLessonIds = Array.from(
    getCompletedLessonIds(
      lessonProgress,
      catalog.flatMap((course) => course.lessons),
    ),
  );

  return (
    <main className="mobile-shell min-h-screen">
      <AppHeader title="Course Library" backHref="/dashboard" showMenu={false} />
      <section className="px-6 pb-28 pt-6">
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
