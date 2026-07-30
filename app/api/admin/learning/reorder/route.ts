import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import {
  getEnumField,
  getStringField,
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
  const kind = getEnumField(bodyResult.data, "kind", ["page", "block"], issues);
  const direction = getEnumField(bodyResult.data, "direction", ["up", "down"], issues);

  if (issues.length > 0 || !kind || !direction) {
    return validationErrorResponse(issues);
  }

  const { supabase } = await requireAdmin();

  if (kind === "page") {
    const pageIssues: ValidationIssue[] = [];
    const lessonId = getStringField(bodyResult.data, "lessonId", pageIssues);
    const pageId = getStringField(bodyResult.data, "pageId", pageIssues);

    if (pageIssues.length > 0 || !lessonId || !pageId) {
      return validationErrorResponse(pageIssues);
    }

    const { error } = await supabase.rpc("admin_reorder_lesson_page", {
      p_lesson_id: lessonId,
      p_page_id: pageId,
      p_direction: direction,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ status: "updated" });
  }

  if (kind === "block") {
    const blockIssues: ValidationIssue[] = [];
    const pageId = getStringField(bodyResult.data, "pageId", blockIssues);
    const blockId = getStringField(bodyResult.data, "blockId", blockIssues);

    if (blockIssues.length > 0 || !pageId || !blockId) {
      return validationErrorResponse(blockIssues);
    }

    const { error } = await supabase.rpc("admin_reorder_lesson_block", {
      p_page_id: pageId,
      p_block_id: blockId,
      p_direction: direction,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ status: "updated" });
  }

  return NextResponse.json({ error: "Unsupported reorder request." }, { status: 400 });
}
