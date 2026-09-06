import { NextResponse } from "next/server";
import { requireMediaEditor } from "@/features/media/server/context";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
export async function POST(request: Request) {
  try {
    const { supabase, organizationId, canManage } = await requireMediaEditor();
    if (!canManage) throw new Error("Media manager access required.");
    const body = await request.json() as { versionId: string; action: string; title?: string; audience?: string; organizations?: string[] };
    const { data, error } = await supabase.rpc("admin_manage_media", { p_version_id: body.versionId, p_action: body.action,
      p_title: body.title, p_audience: body.audience, p_organizations: body.organizations ?? [], p_organization_id: organizationId ?? undefined });
    if (error) throw new Error(error.message);
    if (body.action === "delete") {
      const result = data as { bucket: string; storagePath: string };
      const admin = createSupabaseAdminClient();
      const { error: removeError } = await admin.storage.from(result.bucket).remove([result.storagePath]);
      if (removeError) throw new Error("Media is unavailable; storage cleanup failed. Retry deletion.");
      const { error: cleanupError } = await admin.rpc("service_finish_media_deletion", { p_version_id: body.versionId });
      if (cleanupError) throw new Error(cleanupError.message);
    }
    if (body.action === "revoke" || body.action === "revoke_asset") {
      // Failure leaves a durable outbox record for the next explicit retry.
      const { error: notificationError } = await supabase.rpc("admin_dispatch_media_notifications");
      if (notificationError) return NextResponse.json({ ...data as object, notice: "Media revoked. Editor notifications are pending retry." });
    }
    return NextResponse.json(data);
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Media update failed." }, { status: 403 }); }
}
