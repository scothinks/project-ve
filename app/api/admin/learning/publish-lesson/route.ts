import { NextResponse } from "next/server";
import { revalidateLearningPaths } from "@/app/admin/courses/learning-cache";
import { requireAdmin } from "@/lib/admin";
import {
  getStringField,
  getNumberField,
  readJsonObject,
  validationErrorResponse,
  type ValidationIssue,
} from "@/lib/request-validation";

type AiPublishGuardRow = {
  ai_generated: boolean;
  ai_publish_status: string | null;
};

export async function POST(request: Request) {
  const bodyResult = await readJsonObject(request);

  if (!bodyResult.ok) {
    return validationErrorResponse(bodyResult.issues);
  }

  const issues: ValidationIssue[] = [];
  const lessonId = getStringField(bodyResult.data, "lessonId", issues);
  const expectedRevision = getNumberField(bodyResult.data, "expectedRevision", issues, { integer: true, min: 0 });
  const courseId = getStringField(bodyResult.data, "courseId", issues);

  if (issues.length > 0 || !lessonId || !courseId) {
    return validationErrorResponse(issues);
  }

  const { supabase } = await requireAdmin();

  const { data: guardData, error: guardError } = await supabase
    .from("lessons")
    .select("ai_generated, ai_publish_status")
    .eq("id", lessonId)
    .maybeSingle();

  if (guardError) {
    return NextResponse.json({ error: guardError.message }, { status: 500 });
  }

  const guard = guardData as AiPublishGuardRow | null;
  if (guard?.ai_generated && guard.ai_publish_status !== "ready" && guard.ai_publish_status !== "published") {
    return NextResponse.json(
      { error: "AI-generated lessons can only be published after that lesson's text and media are approved." },
      { status: 422 },
    );
  }

  const { data, error } = await supabase.rpc("admin_publish_lesson_checked", {
    p_lesson_id: lessonId,
    p_expected_revision: expectedRevision!,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.code === "PT409" ? 409 : 422 });
  }

  const result = (data ?? {}) as { publishedAt?: string; draftRevision: number; publishedSnapshot: unknown };

  revalidateLearningPaths(courseId, [lessonId]);

  return NextResponse.json({
    status: "published",
    draftRevision: result.draftRevision,
    publishedSnapshot: result.publishedSnapshot,
    publishedAt: result.publishedAt ?? new Date().toISOString(),
  });
}
