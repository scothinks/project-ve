import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdminCourses, getAdminLessons } from "@/features/learning/admin/data";

export type AdminRecommendationSectionRow = {
  id: string;
  slug: string;
  placement: string;
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
  status: string;
  sort_order: number;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminRecommendationItemRow = {
  id: string;
  section_id: string;
  item_type: "course" | "lesson";
  item_id: string;
  sort_order: number;
  created_at: string;
};

export type AdminRecommendationSection = AdminRecommendationSectionRow & {
  items: Array<
    AdminRecommendationItemRow & {
      label: string;
      status: string;
    }
  >;
};

export async function getAdminRecommendationSections(
  supabase: SupabaseClient,
): Promise<AdminRecommendationSection[]> {
  const [sectionsResult, itemsResult, courses, lessons] = await Promise.all([
    supabase
      .from("recommendation_sections")
      .select("id, slug, placement, eyebrow, title, subtitle, status, sort_order, starts_at, ends_at, created_at, updated_at")
      .eq("placement", "dashboard")
      .order("sort_order", { ascending: true }),
    supabase
      .from("recommendation_items")
      .select("id, section_id, item_type, item_id, sort_order, created_at")
      .order("sort_order", { ascending: true }),
    getAdminCourses(supabase),
    getAdminLessons(supabase),
  ]);

  if (sectionsResult.error) {
    throw sectionsResult.error;
  }

  if (itemsResult.error) {
    throw itemsResult.error;
  }

  const courseMap = new Map(courses.map((course) => [course.id, course]));
  const lessonMap = new Map(lessons.map((lesson) => [lesson.id, lesson]));
  const itemsBySection = new Map<string, AdminRecommendationItemRow[]>();
  const recommendationItems = (itemsResult.data ?? []) as AdminRecommendationItemRow[];
  const recommendationSections = (sectionsResult.data ?? []) as AdminRecommendationSectionRow[];

  for (const item of recommendationItems) {
    const current = itemsBySection.get(item.section_id) ?? [];
    current.push(item);
    itemsBySection.set(item.section_id, current);
  }

  return recommendationSections.map((section) => ({
    ...section,
    items: (itemsBySection.get(section.id) ?? []).map((item) => {
      if (item.item_type === "course") {
        const course = courseMap.get(item.item_id);
        return {
          ...item,
          label: course?.title ?? item.item_id,
          status: course?.status ?? "missing",
        };
      }

      const lesson = lessonMap.get(item.item_id);
      return {
        ...item,
        label: lesson?.title ?? item.item_id,
        status: lesson?.status ?? "missing",
      };
    }),
  }));
}
