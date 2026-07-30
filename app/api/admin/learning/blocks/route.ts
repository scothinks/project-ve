import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import {
  getStringField,
  readJsonObject,
  validationErrorResponse,
  type ValidationIssue,
} from "@/lib/request-validation";

export async function DELETE(request: Request) {
  const bodyResult = await readJsonObject(request);

  if (!bodyResult.ok) {
    return validationErrorResponse(bodyResult.issues);
  }

  const issues: ValidationIssue[] = [];
  const pageId = getStringField(bodyResult.data, "pageId", issues);
  const blockId = getStringField(bodyResult.data, "blockId", issues);

  if (issues.length > 0 || !pageId || !blockId) {
    return validationErrorResponse(issues);
  }

  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("admin_delete_lesson_block", {
    p_page_id: pageId,
    p_block_id: blockId,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ status: "deleted" });
}
