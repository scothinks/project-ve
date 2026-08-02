"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getRedirectTarget } from "@/features/ai-generation/application/form-input";
import { publishApprovedAiCourseCommand } from "@/features/ai-generation/application/course-finalization";
import {
  assertAdminCoursePublishReady,
  getAdminCourseReadiness,
} from "@/features/learning/admin/course-readiness-data";
import { appendAdminNotice } from "@/lib/admin-feedback";
import { requireAdmin } from "@/lib/admin";
import { ValidationError } from "@/lib/app-errors";
import { sanitizePlainTextInput } from "@/lib/input-safety";
import type { Json } from "@/types/database";

function getCourseId(formData: FormData) {
  const courseId = sanitizePlainTextInput(String(formData.get("courseId") ?? ""), 120);
  if (!courseId) {
    throw new ValidationError("Course is required.");
  }
  return courseId;
}

function getReviewFeedback(formData: FormData) {
  const feedback = sanitizePlainTextInput(String(formData.get("reviewFeedback") ?? ""), 3000).trim();
  if (!feedback) {
    throw new ValidationError("Reviewer feedback is required.");
  }
  return feedback;
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function getCourseReviewRow(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  courseId: string,
) {
  const { data, error } = await supabase
    .from("courses")
    .select("id, ai_generated, ai_generation_notes, ai_publish_status, status")
    .eq("id", courseId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Course not found.");

  return data as {
    ai_generated: boolean;
    ai_generation_notes: Record<string, unknown> | null;
    ai_publish_status: string;
    id: string;
    status: string;
  };
}

function appendReviewHistory(
  notes: Record<string, unknown> | null,
  entry: Record<string, unknown>,
) {
  const current = asRecord(notes);
  const history = Array.isArray(current.editorialReviewHistory)
    ? current.editorialReviewHistory
    : [];

  return {
    ...current,
    editorialReviewHistory: [
      ...history,
      entry,
    ],
  };
}

function revalidateCourseReviewPaths(courseId: string) {
  revalidatePath("/admin/courses");
  revalidatePath(`/admin/courses/${courseId}`);
  revalidatePath("/courses");
  revalidatePath(`/courses/${courseId}`);
  revalidatePath("/dashboard");
}

export async function sendCourseForReview(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const courseId = getCourseId(formData);
  const redirectTo = getRedirectTarget(formData, `/admin/courses/${courseId}?tab=review-publish`);
  const course = await getCourseReviewRow(supabase, courseId);
  const notes = appendReviewHistory(course.ai_generation_notes, {
    actorId: profile.id,
    kind: "sent_for_review",
    requestedAt: new Date().toISOString(),
  });

  const { error } = await supabase
    .from("courses")
    .update({
      ai_generation_notes: notes as Json,
      ai_publish_status: "not_ready",
      ai_text_status: "in_review",
      updated_at: new Date().toISOString(),
    })
    .eq("id", courseId);

  if (error) throw error;

  revalidateCourseReviewPaths(courseId);
  redirect(appendAdminNotice(redirectTo, "Course sent for review."));
}

export async function requestCourseReviewChanges(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const courseId = getCourseId(formData);
  const redirectTo = getRedirectTarget(formData, `/admin/courses/${courseId}?tab=review-publish`);
  const feedback = getReviewFeedback(formData);
  const course = await getCourseReviewRow(supabase, courseId);
  const notes = appendReviewHistory(course.ai_generation_notes, {
    actorId: profile.id,
    feedback,
    kind: "changes_requested",
    requestedAt: new Date().toISOString(),
  });

  const { error } = await supabase
    .from("courses")
    .update({
      ai_generation_notes: notes as Json,
      ai_media_status: "not_started",
      ai_publish_status: "not_ready",
      ai_text_status: "changes_requested",
      updated_at: new Date().toISOString(),
    })
    .eq("id", courseId);

  if (error) throw error;

  revalidateCourseReviewPaths(courseId);
  redirect(appendAdminNotice(redirectTo, "Course changes requested."));
}

export async function approveCourseReview(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const courseId = getCourseId(formData);
  const redirectTo = getRedirectTarget(formData, `/admin/courses/${courseId}?tab=review-publish`);
  const readiness = await getAdminCourseReadiness(supabase, courseId, {
    includeLifecycleApproval: false,
  });

  if (!readiness.canApprove) {
    throw new Error(`Course cannot be approved yet. ${readiness.blockers.map((issue) => issue.detail).join(" ")}`);
  }

  const course = await getCourseReviewRow(supabase, courseId);
  const notes = appendReviewHistory(course.ai_generation_notes, {
    actorId: profile.id,
    kind: "approved",
    requestedAt: new Date().toISOString(),
  });

  const { error } = await supabase
    .from("courses")
    .update({
      ai_generation_notes: notes as Json,
      ai_media_status: "approved",
      ai_publish_status: "ready",
      ai_text_status: "approved",
      updated_at: new Date().toISOString(),
    })
    .eq("id", courseId);

  if (error) throw error;

  revalidateCourseReviewPaths(courseId);
  redirect(appendAdminNotice(redirectTo, "Course approved for publishing."));
}

export async function publishReviewedCourse(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const courseId = getCourseId(formData);
  const redirectTo = getRedirectTarget(formData, `/admin/courses/${courseId}?tab=review-publish`);
  await assertAdminCoursePublishReady(supabase, courseId);
  const course = await getCourseReviewRow(supabase, courseId);

  if (course.ai_generated) {
    const result = await publishApprovedAiCourseCommand(supabase, profile.id, courseId);
    revalidateCourseReviewPaths(result.courseId);
    for (const lessonId of result.lessonIds) {
      revalidatePath(`/admin/courses/lessons/${lessonId}`);
      revalidatePath(`/lessons/${lessonId}`);
    }
    redirect(appendAdminNotice(redirectTo, "Approved AI course published."));
  }

  const notes = appendReviewHistory(course.ai_generation_notes, {
    actorId: profile.id,
    kind: "published",
    requestedAt: new Date().toISOString(),
  });

  const { error } = await supabase
    .from("courses")
    .update({
      ai_generation_notes: notes as Json,
      ai_publish_status: "published",
      status: "published",
      updated_at: new Date().toISOString(),
    })
    .eq("id", courseId);

  if (error) throw error;

  revalidateCourseReviewPaths(courseId);
  redirect(appendAdminNotice(redirectTo, "Course published."));
}

export async function unpublishReviewedCourse(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const courseId = getCourseId(formData);
  const redirectTo = getRedirectTarget(formData, `/admin/courses/${courseId}?tab=review-publish`);
  const course = await getCourseReviewRow(supabase, courseId);
  const notes = appendReviewHistory(course.ai_generation_notes, {
    actorId: profile.id,
    kind: "unpublished",
    requestedAt: new Date().toISOString(),
  });

  const { error } = await supabase
    .from("courses")
    .update({
      ai_generation_notes: notes as Json,
      ai_publish_status: course.ai_publish_status === "published" ? "ready" : course.ai_publish_status,
      status: "draft",
      updated_at: new Date().toISOString(),
    })
    .eq("id", courseId);

  if (error) throw error;

  revalidateCourseReviewPaths(courseId);
  redirect(appendAdminNotice(redirectTo, "Course unpublished."));
}

export async function archiveReviewedCourse(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const courseId = getCourseId(formData);
  const redirectTo = getRedirectTarget(formData, `/admin/courses/${courseId}?tab=review-publish`);
  const course = await getCourseReviewRow(supabase, courseId);
  const notes = appendReviewHistory(course.ai_generation_notes, {
    actorId: profile.id,
    kind: "archived",
    requestedAt: new Date().toISOString(),
  });

  const { error } = await supabase
    .from("courses")
    .update({
      ai_generation_notes: notes as Json,
      status: "archived",
      updated_at: new Date().toISOString(),
    })
    .eq("id", courseId);

  if (error) throw error;

  revalidateCourseReviewPaths(courseId);
  redirect(appendAdminNotice(redirectTo, "Course archived."));
}
