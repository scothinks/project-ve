import { NextResponse } from "next/server";
import { requireMediaEditor } from "@/features/media/server/context";
export async function GET(request: Request) {
  try {
    const { supabase, organizationId, canManage } = await requireMediaEditor();
    if (organizationId || !canManage) throw new Error("Platform Catalog manager access required.");
    const query = new URL(request.url).searchParams;
    const { data, error } = await supabase.rpc("admin_media_permission_targets", { p_search: query.get("search") ?? "", p_selected: (query.get("selected") ?? "").split(",").filter(Boolean) });
    if (error) throw new Error(error.message);
    return NextResponse.json({ organizations: data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Organisations unavailable." }, { status: 403 }); }
}
