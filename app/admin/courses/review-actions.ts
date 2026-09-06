"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getRedirectTarget } from "@/features/ai-generation/application/form-input";
import {
  assertAdminCoursePublishReady,
  getAdminCourseReadiness,
} from "@/features/learning/admin/course-readiness-data";
import { appendAdminNotice } from "@/lib/admin-feedback";
import { requireAdmin } from "@/lib/admin";
import { ValidationError } from "@/lib/app-errors";
import { sanitizePlainTextInput } from "@/lib/input-safety";
import type { Json } from "@/types/database";
import { revalidatePublishedLearningCourseCards } from "@/app/admin/courses/learning-cache";

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
  revalidatePublishedLearningCourseCards();
  revalidatePath("/admin/courses");
  revalidatePath(`/admin/courses/${courseId}`);
  revalidatePath("/courses");
  revalidatePath(`/courses/${courseId}`);
  revalidatePath("/dashboard");
}

export async function sendCourseForReview(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const courseId = getCourseId(formData);
  const redirectTo = getRedirectTarget(formData, `/admin/courses/${courseId}/review`);
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
  const redirectTo = getRedirectTarget(formData, `/admin/courses/${courseId}/review`);
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

function authoredReviewInput(formData: FormData) {
  const revisions=JSON.parse(String(formData.get("lessonRevisions")??"{}")) as Json;
  const updated=String(formData.get("courseUpdated")??"");
  return {p_revisions:revisions,p_updated:updated};
}

export async function approveCourseReview(formData: FormData) {
  const { supabase } = await requireAdmin();
  const courseId = getCourseId(formData);
  const redirectTo = getRedirectTarget(formData, `/admin/courses/${courseId}/review`);
  const readiness = await getAdminCourseReadiness(supabase, courseId, { includeLifecycleApproval: false });
  if (!readiness.canApprove) throw new Error(`Course cannot be approved yet. ${readiness.blockers.map(issue => issue.detail).join(" ")}`);
  if (formData.get("reviewed") !== "on") throw new Error("Confirm you reviewed the course, lessons, quizzes and attached media.");
  const { error } = await supabase.rpc("admin_review_ai_authored_course", { p_course: courseId, ...authoredReviewInput(formData) });
  if (error) throw error;
  revalidateCourseReviewPaths(courseId);
  redirect(appendAdminNotice(redirectTo, "Course reviewed and approved. Publication is a separate action."));
}

export async function publishReviewedCourse(formData: FormData) {
  const { supabase } = await requireAdmin();
  const courseId = getCourseId(formData);
  const redirectTo = getRedirectTarget(formData, `/admin/courses/${courseId}/review`);
  await assertAdminCoursePublishReady(supabase, courseId);
  const { error } = await supabase.rpc("admin_publish_ai_authored_course", { p_course: courseId, ...authoredReviewInput(formData) });
  if (error) throw error;
  revalidateCourseReviewPaths(courseId);
  redirect(appendAdminNotice(redirectTo, "Reviewed course published."));
}

export async function unpublishReviewedCourse(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const courseId = getCourseId(formData);
  const redirectTo = getRedirectTarget(formData, `/admin/courses/${courseId}/review`);
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

export async function restoreCourseToDraft(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const courseId = getCourseId(formData);
  const redirectTo = getRedirectTarget(formData, `/admin/courses/${courseId}/review`);
  const course = await getCourseReviewRow(supabase, courseId);
  const notes = appendReviewHistory(course.ai_generation_notes, {
    actorId: profile.id,
    kind: "restored_to_draft",
    requestedAt: new Date().toISOString(),
  });

  const { error } = await supabase
    .from("courses")
    .update({
      ai_generation_notes: notes as Json,
      status: "draft",
      updated_at: new Date().toISOString(),
    })
    .eq("id", courseId);

  if (error) throw error;

  revalidateCourseReviewPaths(courseId);
  redirect(appendAdminNotice(redirectTo, "Course restored to draft."));
}

export async function archiveReviewedCourse(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const courseId = getCourseId(formData);
  const redirectTo = getRedirectTarget(formData, `/admin/courses/${courseId}/review`);
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
