import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Course, Lesson } from "@/lib/lessons";

type RecommendationSectionRow = {
  id: string;
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
  sort_order: number;
};

type RecommendationItemRow = {
  id: string;
  section_id: string;
  item_type: "course" | "lesson";
  item_id: string;
  sort_order: number;
};

export type DashboardRecommendationItem =
  | {
      id: string;
      type: "course";
      course: Course;
      sortOrder: number;
    }
  | {
      id: string;
      type: "lesson";
      lesson: Lesson;
      sortOrder: number;
    };

export type DashboardRecommendationSection = {
  id: string;
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
  sortOrder: number;
  items: DashboardRecommendationItem[];
};

function indexCatalog(catalog: Course[]) {
  const courseMap = new Map<string, Course>();
  const lessonMap = new Map<string, Lesson>();

  for (const course of catalog) {
    courseMap.set(course.id, course);
    courseMap.set(course.slug, course);

    for (const lesson of course.lessons) {
      lessonMap.set(lesson.id, lesson);
      lessonMap.set(lesson.slug, lesson);
    }
  }

  return { courseMap, lessonMap };
}

export async function getDashboardRecommendationSections(
  supabase: SupabaseClient | null,
  catalog: Course[],
): Promise<DashboardRecommendationSection[]> {
  if (!supabase || catalog.length === 0) {
    return [];
  }

  const { courseMap, lessonMap } = indexCatalog(catalog);

  try {
    const { data: sections, error: sectionsError } = await supabase
      .from("recommendation_sections")
      .select("id, eyebrow, title, subtitle, sort_order")
      .eq("placement", "dashboard")
      .eq("status", "published")
      .order("sort_order", { ascending: true })
      .returns<RecommendationSectionRow[]>();

    if (sectionsError || !sections?.length) {
      return [];
    }

    const sectionIds = sections.map((section) => section.id);
    const { data: items, error: itemsError } = await supabase
      .from("recommendation_items")
      .select("id, section_id, item_type, item_id, sort_order")
      .in("section_id", sectionIds)
      .order("sort_order", { ascending: true })
      .returns<RecommendationItemRow[]>();

    if (itemsError) {
      return [];
    }

    const itemsBySection = new Map<string, DashboardRecommendationItem[]>();

    for (const item of items ?? []) {
      const sectionItems = itemsBySection.get(item.section_id) ?? [];

      if (item.item_type === "course") {
        const course = courseMap.get(item.item_id);
        if (course) {
          sectionItems.push({
            id: item.id,
            type: "course",
            course,
            sortOrder: item.sort_order,
          });
        }
      } else {
        const lesson = lessonMap.get(item.item_id);
        if (lesson) {
          sectionItems.push({
            id: item.id,
            type: "lesson",
            lesson,
            sortOrder: item.sort_order,
          });
        }
      }

      itemsBySection.set(item.section_id, sectionItems);
    }

    return sections
      .map((section) => ({
        id: section.id,
        eyebrow: section.eyebrow,
        title: section.title,
        subtitle: section.subtitle,
        sortOrder: section.sort_order,
        items: (itemsBySection.get(section.id) ?? []).sort(
          (first, second) => first.sortOrder - second.sortOrder,
        ),
      }))
      .filter((section) => section.items.length > 0);
  } catch {
    return [];
  }
}
