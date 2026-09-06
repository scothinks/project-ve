import { NextResponse } from "next/server";
import { requireMediaEditor } from "@/features/media/server/context";
export async function GET(request: Request) {
  try {
    const { supabase, organizationId, canManage } = await requireMediaEditor();
    const params = new URL(request.url).searchParams;
    const { data, error } = await supabase.rpc("admin_media_library", {
      p_organization_id: organizationId ?? undefined,
      p_source: params.get("source") ?? "organization",
      p_search: (params.get("search") ?? "").slice(0, 120),
      p_type: params.get("type") ?? "image",
      p_offset: Number(params.get("offset") ?? 0),
      p_manage: params.get("manage") === "true" && canManage,
      p_course_id: params.get("courseId") ?? undefined,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ ...(data as object), organizationId }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Library unavailable." }, { status: 403 });
  }
}
