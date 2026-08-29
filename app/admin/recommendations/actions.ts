"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  getAdminCourses,
  getAdminLessons,
  getAdminRecommendationSections,
  requireAdminWorkspaceRole,
  type AdminWorkspace,
} from "@/lib/admin";
import { PLATFORM_CATALOG_WORKSPACE_ID } from "@/features/admin/shared/workspace";
import { appendAdminNotice } from "@/lib/admin-feedback";
import { sanitizePlainTextInput } from "@/lib/input-safety";

const RECOMMENDATION_ROLES = [
  "organisation_owner",
  "organisation_admin",
  "programme_manager",
  "content_editor",
];

function organizationIdForWorkspace(workspace: AdminWorkspace) {
  if (workspace.type !== "organization" || workspace.id === PLATFORM_CATALOG_WORKSPACE_ID) {
    return null;
  }

  return workspace.id;
}

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
  supabase: Awaited<ReturnType<typeof requireAdminWorkspaceRole>>["supabase"],
  input: {
    sectionId: string;
    title: string;
    subtitle: string;
    eyebrow: string;
    status: "draft" | "published";
    sortOrder: number;
    organizationId: string | null;
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
    p_organization_id: input.organizationId,
  });

  if (error) {
    throw error;
  }
}

async function addSectionItem(
  supabase: Awaited<ReturnType<typeof requireAdminWorkspaceRole>>["supabase"],
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

async function deleteSectionItem(
  supabase: Awaited<ReturnType<typeof requireAdminWorkspaceRole>>["supabase"],
  itemId: string,
) {
  const { error } = await supabase.rpc("admin_delete_recommendation_item", {
    p_item_id: itemId,
  });

  if (error) {
    throw error;
  }
}

export async function saveRecommendationSection(formData: FormData) {
  const sectionId = sanitizePlainTextInput(String(formData.get("sectionId") ?? ""), 120);
  const { supabase, workspace } = await requireAdminWorkspaceRole(RECOMMENDATION_ROLES);
  const { error } = await supabase.rpc("admin_upsert_recommendation_section", {
    p_section_id: sectionId,
    p_title: sanitizePlainTextInput(String(formData.get("title") ?? ""), 180),
    p_subtitle: sanitizePlainTextInput(String(formData.get("subtitle") ?? ""), 300),
    p_eyebrow: sanitizePlainTextInput(String(formData.get("eyebrow") ?? ""), 80),
    p_status: String(formData.get("status") ?? "draft"),
    p_sort_order: parseInteger(formData.get("sortOrder")),
    p_starts_at: parseOptionalDate(formData.get("startsAt")),
    p_ends_at: parseOptionalDate(formData.get("endsAt")),
    p_organization_id: organizationIdForWorkspace(workspace),
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
  const { supabase } = await requireAdminWorkspaceRole(RECOMMENDATION_ROLES);
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
  const { supabase } = await requireAdminWorkspaceRole(RECOMMENDATION_ROLES);
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
  const { supabase } = await requireAdminWorkspaceRole(RECOMMENDATION_ROLES);
  const { error } = await supabase.rpc("admin_delete_recommendation_item", {
    p_item_id: itemId,
  });

  if (error) throw error;

  revalidateRecommendationPaths();
  redirect(appendAdminNotice("/admin/recommendations", "Item removed from section."));
}

export async function createDefaultRecommendationSections() {
  const { supabase, workspace } = await requireAdminWorkspaceRole(RECOMMENDATION_ROLES);
  const organizationId = organizationIdForWorkspace(workspace);
  // id is globally unique, so per-workspace defaults need their own ids —
  // otherwise every workspace's "reset defaults" would fight over the same
  // two rows.
  const scopeSuffix = organizationId ? `-${organizationId}` : "";
  const starterPackId = `rec-starter-pack${scopeSuffix}`;
  const focusAreaId = `rec-focus-area${scopeSuffix}`;
  const [courses, lessons, sections] = await Promise.all([
    getAdminCourses(supabase, workspace.id),
    getAdminLessons(supabase),
    getAdminRecommendationSections(supabase, workspace.id),
  ]);
  const firstCourse = courses[0];

  await upsertSection(supabase, {
    sectionId: starterPackId,
    title: "Start Learning",
    subtitle: "Begin with practical values lessons learners can use right away.",
    eyebrow: "Starter Pack",
    status: "published",
    sortOrder: 10,
    organizationId,
  });

  await upsertSection(supabase, {
    sectionId: focusAreaId,
    title: "Browse Courses",
    subtitle: "Tutor-curated courses can be added here when you want a focused set.",
    eyebrow: "Focus Area",
    status: "published",
    sortOrder: 20,
    organizationId,
  });

  const defaultSectionIds = new Set([starterPackId, focusAreaId]);
  const existingDefaultItems = sections
    .filter((section) => defaultSectionIds.has(section.id))
    .flatMap((section) => section.items);

  for (const item of existingDefaultItems) {
    await deleteSectionItem(supabase, item.id);
  }

  if (firstCourse) {
    const starterLessons = lessons
      .filter((lesson) => lesson.course_id === firstCourse.id)
      .sort((first, second) => first.sort_order - second.sort_order);

    for (const [index, lesson] of starterLessons.entries()) {
      await addSectionItem(supabase, {
        sectionId: starterPackId,
        itemType: "lesson",
        itemId: lesson.id,
        sortOrder: index + 1,
      });
    }
  }

  revalidateRecommendationPaths();
  redirect(
    appendAdminNotice(
      "/admin/recommendations",
      "Default sections created. Focus Area starts empty until you add courses.",
    ),
  );
}
