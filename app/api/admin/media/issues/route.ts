import { NextResponse } from "next/server";
import { requireMediaEditor } from "@/features/media/server/context";
export async function GET() {
  try {
    const { supabase, organizationId } = await requireMediaEditor();
    const { data, error } = await supabase.rpc("admin_media_issues", { p_organization_id: organizationId ?? undefined });
    if (error) throw new Error(error.message);
    return NextResponse.json({ issues: data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Review unavailable." }, { status: 403 }); }
}
