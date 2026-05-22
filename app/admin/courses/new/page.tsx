import { AdminCard, AdminPageHeader } from "@/components/admin/AdminPrimitives";
import { CourseForm } from "@/components/admin/LearningForms";
import { getAdminCourseCategories, getAdminCourses, requireAdmin } from "@/lib/admin";

export default async function NewCoursePage() {
  const { supabase } = await requireAdmin();
  const [categories, courses] = await Promise.all([
    getAdminCourseCategories(supabase),
    getAdminCourses(supabase),
  ]);
  const nextSortOrder =
    courses.reduce((highest, course) => Math.max(highest, course.sort_order), 0) + 1;

  return (
    <>
      <AdminPageHeader
        backHref="/admin/courses"
        backLabel="Courses"
        eyebrow="Learning"
        title="Add course"
        subtitle="Create a course shell before adding lessons and quizzes."
      />
      <AdminCard>
        <CourseForm categories={categories} nextSortOrder={nextSortOrder} />
      </AdminCard>
    </>
  );
}
