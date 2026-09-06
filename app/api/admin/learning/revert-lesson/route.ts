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
  const { data, error } = await supabase.rpc("admin_revert_lesson_checked", {
    p_lesson_id: lessonId,
    p_expected_revision: expectedRevision!,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.code === "PT409" ? 409 : 422 });
  }

  revalidateLearningPaths(courseId, [lessonId]);

  return NextResponse.json(data);
}
