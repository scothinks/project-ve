import { NextResponse } from "next/server";
import { uploadMedia } from "@/features/media/server/upload";
import { requireMediaEditor } from "@/features/media/server/context";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try { return NextResponse.json({ asset: await uploadMedia(request) }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed." }, { status: 422 }); }
}
// This endpoint removes a generation/editorial placement, never its shared file.
// Physical library deletion uses the manager boundary in /api/admin/media/assets.
export async function DELETE(request: Request) {
  try {
    const { supabase } = await requireMediaEditor();
    const { assetId } = await request.json() as { assetId: string };
    const { error } = await supabase.rpc("admin_remove_media_placement", { p_media_id: assetId });
    if (error) throw new Error(error.message);
    return NextResponse.json({ assetId, status: "deleted" });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Delete failed." }, { status: 403 }); }
}
