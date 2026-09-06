import { imageAuthoringRequest } from "@/features/ai-generation/authoring/image-requests";
import { after, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { revalidateLearningPaths } from "@/app/admin/courses/learning-cache";
import { dispatchAuthoringPage } from "@/features/ai-generation/authoring/worker";
import { listAuthoringResults, readAuthoringResult } from "@/features/ai-generation/authoring/reads";
import { pageAuthoringEnabled } from "@/features/ai-generation/authoring/availability";
import { logAppError } from "@/lib/app-errors";
import { PLATFORM_CATALOG_WORKSPACE_ID } from "@/features/admin/shared/workspace";

import { quoteCourse, saveCourseOutline } from "@/features/ai-generation/authoring/course-requests";

export const maxDuration = 300;
function json(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers); headers.set("Cache-Control", "private, no-store");
  return NextResponse.json(body, { ...init, headers });
}

export async function GET(request: Request) {
  const { supabase, workspace } = await requireAdmin();
  const params = new URL(request.url).searchParams;
  try {
    const data = params.get("id")
      ? await readAuthoringResult(supabase, params.get("id")!)
      : await listAuthoringResults(supabase, workspace.type === "organization" && workspace.id !== PLATFORM_CATALOG_WORKSPACE_ID ? workspace.id : null,
          params.get("lessonId") ?? undefined, Number(params.get("offset") ?? 0) || 0, params.get("courseId") ?? undefined);
    return json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return json({ error: "These results are unavailable. Check your access and try again." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  const { supabase, workspace } = await requireAdmin();
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return json({ error: "Invalid request." }, { status: 400 });
  const { action, id } = body;
  if (["quote", "start"].includes(action) && !pageAuthoringEnabled()) {
    return json({ error: "AI assistance is not enabled yet. Your saved results remain available." }, { status: 409 });
  }
  try {
    if ((action === "quote" && body.kind === "image") || ["imageSetup", "imageStyle"].includes(action)) return json(await imageAuthoringRequest(supabase, body));
    if (action === "quote" && ["course_outline", "course_draft"].includes(body.kind)) {
      return json(await quoteCourse(supabase, body, workspace.type === "organization" && workspace.id !== PLATFORM_CATALOG_WORKSPACE_ID ? workspace.id : null));
    }
    if (action === "saveOutline") return json(await saveCourseOutline(supabase, body));
    if (action === "quote" && body.kind && body.kind !== "page") {
      if (!["quiz", "lesson_plan", "lesson_draft"].includes(body.kind) || typeof body.courseId !== "string"
        || (body.lessonId != null && typeof body.lessonId !== "string")
        || (body.focus !== undefined && (typeof body.focus !== "string" || body.focus.length > 1000))
        || (body.refinement !== undefined && (typeof body.refinement !== "string" || body.refinement.length > 1000))
        || (body.parentId !== undefined && typeof body.parentId !== "string")
        || (body.count !== undefined && (!Number.isSafeInteger(body.count) || body.count < 1 || body.count > 3))
        || (body.selected !== undefined && (!Number.isSafeInteger(body.selected) || body.selected < 0 || body.selected > 2))) {
        return json({ error: "Choose a valid request." }, { status: 400 });
      }
      const { data, error } = await supabase.rpc("admin_quote_ai_assistance", {
        p_course_id: body.courseId, p_kind: body.kind, p_lesson_id: body.lessonId ?? undefined,
        p_focus: body.focus ?? "", p_count: body.count ?? 1, p_parent_id: body.parentId,
        p_refinement: body.refinement ?? "", p_selected: body.selected,
      });
      if (error) throw error;
      return json(data, { headers: { "Cache-Control": "private, no-store" } });
    }
    if (action === "quote") {
      if (typeof body.lessonId !== "string" || (body.focus !== undefined && typeof body.focus !== "string")
        || (body.pageType !== undefined && typeof body.pageType !== "string")
        || !Number.isSafeInteger(body.revision) || (body.position !== undefined && !Number.isSafeInteger(body.position))) {
        return json({ error: "We could not read the lesson request. Please try again." }, { status: 400 });
      }
      const { data, error } = await supabase.rpc("admin_quote_ai_page", {
        p_lesson_id: body.lessonId, p_revision: body.revision, p_focus: body.focus ?? "", p_page_type: body.pageType ?? "auto",
        p_position: body.position ?? 1, p_parent_id: body.parentId, p_refinement: body.refinement ?? "",
      });
      if (error) throw error;
      return json(data);
    }
    if (typeof id !== "string") return json({ error: "Select a result." }, { status: 400 });
    if (action === "start") {
      if (!process.env.OPENAI_API_KEY) return json({ error: "Generation is unavailable. No credits have been reserved." }, { status: 503 });
      const { data, error } = await supabase.rpc("admin_start_ai_page", { p_id: id });
      if (error) throw error;
      // Trusted same-server wake-up after acknowledgement; cron remains recovery.
      after(async () => {
        try { await dispatchAuthoringPage(createSupabaseAdminClient(), id); }
        catch (error) { logAppError(error, { operation: "admin.ai_authoring.dispatch", resourceId: id }); }
      });
      return json(data);
    }
    if (action === "apply") {
      const result = await readAuthoringResult(supabase, id);
      if (result.kind === "image") {
        const receipt = await imageAuthoringRequest(supabase, { action: "apply", id });
        if (receipt.status === "not_saved") return json({ error: receipt.error }, { status: 409 });
        try { revalidateLearningPaths(result.courseId, [result.lessonId].filter(Boolean)); }
        catch (error) { logAppError(error, { operation: "admin.ai_authoring.invalidate", resourceId: id }); }
        return json(receipt);
      }
      if (result.kind === "course_draft") {
        const prepared = await supabase.rpc("admin_prepare_ai_course_apply", { p_id: id });
        if (prepared.error) throw prepared.error;
        const { data, error } = await supabase.rpc("admin_apply_ai_course", { p_id: id });
        if (error) throw error;
        const receipt = data as { status: string; courseId: string; lessonIds: string[]; error?: string };
        if (receipt.status === "not_saved") return json({ error: receipt.error }, { status: 409 });
        try { revalidateLearningPaths(receipt.courseId, receipt.lessonIds); }
        catch (error) { logAppError(error, { operation: "admin.ai_authoring.invalidate", resourceId: id }); }
        return json(data);
      }
      const assistance = result.kind && result.kind !== "page";
      // A replay uses the persisted selection when the response or navigation was lost.
      const selection = (result as unknown as { selection?: number[] }).selection ?? body.selection;
      if (assistance && (!Array.isArray(selection) || !selection.length || selection.length > 3
        || selection.some((i: unknown) => !Number.isSafeInteger(i) || Number(i) < 0 || Number(i) > 2))) {
        return json({ error: "Select the items to add." }, { status: 400 });
      }
      const prepared = assistance
        ? await supabase.rpc("admin_prepare_ai_assistance_apply", { p_id: id, p_selection: selection })
        : await supabase.rpc("admin_prepare_ai_page_apply", { p_id: id });
      if (prepared.error) throw prepared.error;
      const { data, error } = assistance
        ? await supabase.rpc("admin_apply_ai_assistance", { p_id: id })
        : await supabase.rpc("admin_apply_ai_page", { p_id: id });
      if (error) throw error;
      const receipt = data as { status?: string; error?: string; lessonId?: string };
      if (receipt.status === "not_saved") return json({ error: receipt.error }, { status: 409 });
      try { revalidateLearningPaths(result.courseId, [receipt.lessonId ?? result.lessonId].filter(Boolean)); }
      catch (error) { logAppError(error, { operation: "admin.ai_authoring.invalidate", resourceId: id }); }
      return json(data);
    }
    if (action === "stop") {
      const { data, error } = await supabase.rpc("admin_stop_ai_result", { p_id: id });
      if (error) throw error;
      return json(data);
    }
    if (action === "delete") {
      const { error } = await supabase.rpc("admin_delete_ai_result", { p_id: id });
      if (error) throw error;
      return json({ deleted: true });
    }
    return json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    const e = error as { code?: string; message?: string };
    const status = e.code === "PT409" ? 409 : e.code === "42501" ? 403 : e.code === "22023" || e.code === "22P02" || e.code === "P0001" ? 422 : 503;
    return json({ error: status === 503 ? "We could not confirm the outcome. Reopen this result to check before trying again."
      : e.code === "42501" ? "You no longer have access to this result." : e.message ?? "This action could not be completed." }, { status });
  }
}
