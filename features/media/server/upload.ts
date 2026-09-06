import "server-only";
import { randomUUID } from "node:crypto";
import { validateImageUpload } from "@/lib/admin-media-upload";
import { normalizeImageFit, normalizeImagePosition } from "@/lib/image-presentation";
import { sanitizePlainTextInput } from "@/lib/input-safety";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { requireMediaEditor } from "./context";
export async function uploadMedia(request: Request) {
  const { supabase, organizationId, canManage } = await requireMediaEditor();
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new Error("Choose an image file.");
  if (file.size > 10 * 1024 * 1024) throw new Error("Images must be 10 MB or smaller.");
  const text = (name: string, length: number) => sanitizePlainTextInput(String(form.get(name) ?? ""), length).trim();
  const altText = text("altText", 240);
  if (!altText) throw new Error("Alt text is required.");
  if (form.get("rightsConfirmed") !== "true") throw new Error("Confirm you have permission for in-project reuse, cropping and derivation without mandatory attribution.");
  const assetId = text("assetId", 36);
  if (assetId && !canManage) throw new Error("Only media managers can create a replacement version.");
  // A saved target must belong to the selected workspace. New-course uploads
  // need no target: the registered file belongs directly to this workspace.
  let courseId = text("courseId", 120);
  const lessonId = text("lessonId", 120);
  if (lessonId) {
    const { data, error } = await supabase.from("lessons").select("course_id").eq("id", lessonId).single();
    if (error || !data || (courseId && courseId !== data.course_id)) throw new Error("Invalid lesson media context.");
    courseId = data.course_id;
  }
  if (courseId) {
    const { data, error } = await supabase.from("courses").select("organization_id").eq("id", courseId).single();
    if (error || !data || data.organization_id !== organizationId) throw new Error("Select the course's workspace before uploading media.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const validation = validateImageUpload({ bytes, fileName: file.name, mimeType: file.type });
  if (!validation.ok) throw new Error(validation.error);
  const path = `registry/${randomUUID()}.${validation.value.extension}`;
  const admin = createSupabaseAdminClient();
  const bucket = admin.storage.from("learning-media-private");
  const { error: uploadError } = await bucket.upload(path, bytes, { contentType: validation.value.mimeType, upsert: false });
  if (uploadError) throw new Error(uploadError.message);
  const { data, error } = await admin.rpc("service_register_media", {
    // SQL NULL denotes platform ownership; generated RPC Args omit nullability.
    p_organization_id: organizationId as string,
    p_storage_path: path,
    p_mime_type: validation.value.mimeType,
    p_size: bytes.byteLength,
    p_title: text("title", 180) || text("placement", 180) || file.name,
    p_alt_text: altText,
    p_rights_evidence: text("rightsEvidence", 2000) || "Uploader attests to the project_reuse rights profile.",
    p_asset_id: assetId || undefined,
  });
  if (error) { await bucket.remove([path]); throw new Error(error.message); }
  // Presentation belongs to the pending placement, not the shared original.
  return { ...(data as object), caption: text("caption", 500), metadata: {
    fit: normalizeImageFit(text("fit", 20)),
    positionX: normalizeImagePosition(Number.parseFloat(String(form.get("positionX") ?? "")), 50),
    positionY: normalizeImagePosition(Number.parseFloat(String(form.get("positionY") ?? "")), 50),
  } };

}
