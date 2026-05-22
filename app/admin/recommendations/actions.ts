"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAdminCourses, getAdminLessons, requireAdmin } from "@/lib/admin";
import { appendAdminNotice } from "@/lib/admin-feedback";
import { sanitizePlainTextInput } from "@/lib/input-safety";

function parseInteger(value: FormDataEntryValue | null, fallback = 0) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseOptionalDate(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function revalidateRecommendationPaths() {
  revalidatePath("/admin/recommendations");
  revalidatePath("/dashboard");
}

async function upsertSection(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  input: {
    sectionId: string;
    title: string;
    subtitle: string;
    eyebrow: string;
    status: "draft" | "published";
    sortOrder: number;
  },
) {
  const { error } = await supabase.rpc("admin_upsert_recommendation_section", {
    p_section_id: input.sectionId,
    p_title: input.title,
    p_subtitle: input.subtitle,
    p_eyebrow: input.eyebrow,
    p_status: input.status,
    p_sort_order: input.sortOrder,
    p_starts_at: null,
    p_ends_at: null,
  });

  if (error) {
    throw error;
  }
}

async function addSectionItem(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  input: {
    sectionId: string;
    itemType: "course" | "lesson";
    itemId: string;
    sortOrder: number;
  },
) {
  const { error } = await supabase.rpc("admin_add_recommendation_item", {
    p_section_id: input.sectionId,
    p_item_type: input.itemType,
    p_item_id: input.itemId,
    p_sort_order: input.sortOrder,
  });

  if (error) {
    throw error;
  }
}

export async function saveRecommendationSection(formData: FormData) {
  const sectionId = sanitizePlainTextInput(String(formData.get("sectionId") ?? ""), 120);
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("admin_upsert_recommendation_section", {
    p_section_id: sectionId,
    p_title: sanitizePlainTextInput(String(formData.get("title") ?? ""), 180),
    p_subtitle: sanitizePlainTextInput(String(formData.get("subtitle") ?? ""), 300),
    p_eyebrow: sanitizePlainTextInput(String(formData.get("eyebrow") ?? ""), 80),
    p_status: String(formData.get("status") ?? "draft"),
    p_sort_order: parseInteger(formData.get("sortOrder")),
    p_starts_at: parseOptionalDate(formData.get("startsAt")),
    p_ends_at: parseOptionalDate(formData.get("endsAt")),
  });

  if (error) throw error;

  revalidateRecommendationPaths();
  redirect(
    appendAdminNotice(
      "/admin/recommendations",
      sectionId ? "Section saved." : "Section created.",
    ),
  );
}

export async function setRecommendationSectionStatus(formData: FormData) {
  const sectionId = sanitizePlainTextInput(String(formData.get("sectionId") ?? ""), 120);
  const status = String(formData.get("status") ?? "draft") === "published" ? "published" : "draft";
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("admin_set_recommendation_section_status", {
    p_section_id: sectionId,
    p_status: status,
  });

  if (error) throw error;

  revalidateRecommendationPaths();
  redirect(
    appendAdminNotice(
      "/admin/recommendations",
      status === "published" ? "Section enabled." : "Section disabled.",
    ),
  );
}

export async function addRecommendationItem(formData: FormData) {
  const sectionId = sanitizePlainTextInput(String(formData.get("sectionId") ?? ""), 120);
  const itemRef = sanitizePlainTextInput(String(formData.get("itemRef") ?? ""), 240);
  const [itemType, ...itemIdParts] = itemRef.split(":");
  const itemId = itemIdParts.join(":");
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("admin_add_recommendation_item", {
    p_section_id: sectionId,
    p_item_type: itemType,
    p_item_id: itemId,
    p_sort_order: parseInteger(formData.get("sortOrder")),
  });

  if (error) throw error;

  revalidateRecommendationPaths();
  redirect(appendAdminNotice("/admin/recommendations", "Item added to section."));
}

export async function deleteRecommendationItem(formData: FormData) {
  const itemId = sanitizePlainTextInput(String(formData.get("itemId") ?? ""), 80);
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("admin_delete_recommendation_item", {
    p_item_id: itemId,
  });

  if (error) throw error;

  revalidateRecommendationPaths();
  redirect(appendAdminNotice("/admin/recommendations", "Item removed from section."));
}

export async function createDefaultRecommendationSections() {
  const { supabase } = await requireAdmin();
  const [courses, lessons] = await Promise.all([getAdminCourses(supabase), getAdminLessons(supabase)]);
  const firstCourse = courses[0];

  await upsertSection(supabase, {
    sectionId: "rec-starter-pack",
    title: "Start Learning",
    subtitle: "Begin with practical values lessons learners can use right away.",
    eyebrow: "Starter Pack",
    status: "published",
    sortOrder: 10,
  });

  await upsertSection(supabase, {
    sectionId: "rec-focus-area",
    title: "Browse Courses",
    subtitle: "Surface full courses learners can explore at their own pace.",
    eyebrow: "Focus Area",
    status: "published",
    sortOrder: 20,
  });

  if (firstCourse) {
    const starterLessons = lessons
      .filter((lesson) => lesson.course_id === firstCourse.id)
      .sort((first, second) => first.sort_order - second.sort_order);

    for (const [index, lesson] of starterLessons.entries()) {
      await addSectionItem(supabase, {
        sectionId: "rec-starter-pack",
        itemType: "lesson",
        itemId: lesson.id,
        sortOrder: index + 1,
      });
    }
  }

  for (const [index, course] of courses.entries()) {
    await addSectionItem(supabase, {
      sectionId: "rec-focus-area",
      itemType: "course",
      itemId: course.id,
      sortOrder: index + 1,
    });
  }

  revalidateRecommendationPaths();
  redirect(appendAdminNotice("/admin/recommendations", "Default sections created."));
}
