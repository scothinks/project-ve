import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildCmsStoragePath, validateImageUpload } from "@/lib/admin-media-upload";
import { parseOrganizationEntitlements } from "@/features/organizations/entitlements";
import { sanitizePlainTextInput } from "@/lib/input-safety";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient, getCurrentUserProfile } from "@/lib/supabase-server";
import type { Database } from "@/types/database";

export const runtime = "nodejs";

const allowedAssetTypes = new Set(["cover", "image", "infographic", "thumbnail"]);

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function getText(formData: FormData, key: string, maxLength = 120) {
  return sanitizePlainTextInput(String(formData.get(key) ?? ""), maxLength).trim();
}

function getMediaBucket() {
  return process.env.LEARNING_MEDIA_BUCKET || "learning-media";
}

function storageLimitMessage(maxStorageBytes: number) {
  return maxStorageBytes === 100 * 1024 * 1024
    ? "Starter organisations include 100 MB of image storage."
    : "This upload exceeds the organisation storage allowance.";
}

async function authorizeMediaWrite({
  organizationId,
  profileRole,
  supabase,
}: {
  organizationId: string | null;
  profileRole: string | null | undefined;
  supabase: SupabaseClient<Database>;
}) {
  if (!organizationId) {
    return profileRole === "admin"
      ? null
      : jsonError("Only platform admins can manage platform CMS media.", 403);
  }

  const { data, error } = await supabase.rpc("current_user_can_edit_organization_content", {
    p_organization_id: organizationId,
  });

  if (error) {
    return jsonError("Could not validate organisation media permissions.", 500);
  }

  return data
    ? null
    : jsonError("Organisation content editor access is required for this media.", 403);
}

async function resolveMediaCourseContext({
  adminSupabase,
  courseIdInput,
  lessonIdInput,
}: {
  adminSupabase: ReturnType<typeof createSupabaseAdminClient>;
  courseIdInput: string | null;
  lessonIdInput: string | null;
}) {
  let courseId = courseIdInput || null;
  const lessonId = lessonIdInput || null;

  if (lessonId) {
    const { data: lesson, error: lessonError } = await adminSupabase
      .from("lessons")
      .select("id, course_id")
      .eq("id", lessonId)
      .maybeSingle();

    if (lessonError) {
      return { error: jsonError("Could not validate the lesson media context.", 500) };
    }

    if (!lesson) {
      return { error: jsonError("Lesson media context was not found.", 404) };
    }

    if (courseId && courseId !== lesson.course_id) {
      return { error: jsonError("Lesson media context does not belong to the selected course.", 400) };
    }

    courseId = lesson.course_id;
  }

  if (!courseId && !lessonId) {
    return { error: jsonError("Upload media after choosing a course or lesson context.", 400) };
  }

  if (!courseId) {
    return { error: jsonError("Course media context was not found.", 404) };
  }

  const { data: courseContext, error: courseContextError } = await adminSupabase
    .from("courses")
    .select("id, organization_id")
    .eq("id", courseId)
    .maybeSingle();

  if (courseContextError) {
    return { error: jsonError("Could not validate the course media context.", 500) };
  }

  if (!courseContext) {
    return { error: jsonError("Course media context was not found.", 404) };
  }

  return {
    courseContext: {
      id: courseContext.id,
      organization_id: courseContext.organization_id as string | null,
    },
    lessonId,
  };
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return jsonError("Supabase is not configured.", 503);
  }

  const { user, profile } = await getCurrentUserProfile(supabase);
  if (!user) {
    return jsonError("Sign in before uploading media.", 401);
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return jsonError("Choose an image file to upload.", 400);
  }

  const altText = getText(formData, "altText", 240);
  if (!altText) {
    return jsonError("Alt text is required for uploaded CMS images.", 400);
  }

  const assetType = getText(formData, "assetType", 40) || "image";
  if (!allowedAssetTypes.has(assetType)) {
    return jsonError("This media placement does not support direct upload.", 400);
  }

  const placement = getText(formData, "placement", 100) || "CMS upload";
  const courseIdInput = getText(formData, "courseId", 120);
  const lessonIdInput = getText(formData, "lessonId", 120);
  const caption = getText(formData, "caption", 500) || null;
  const fit = getText(formData, "fit", 20);
  const positionX = Number.parseInt(getText(formData, "positionX", 4), 10);
  const positionY = Number.parseInt(getText(formData, "positionY", 4), 10);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const validation = validateImageUpload({
    bytes,
    fileName: file.name,
    mimeType: file.type,
  });

  if (!validation.ok) {
    return jsonError(validation.error, 400);
  }

  let adminSupabase: ReturnType<typeof createSupabaseAdminClient>;
  try {
    adminSupabase = createSupabaseAdminClient();
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Supabase storage is not configured.", 503);
  }
  let courseId = courseIdInput || null;
  const lessonId = lessonIdInput || null;
  const resolvedContext = await resolveMediaCourseContext({
    adminSupabase,
    courseIdInput: courseId,
    lessonIdInput: lessonId,
  });
  if (resolvedContext.error) {
    return resolvedContext.error;
  }
  const { courseContext } = resolvedContext;
  courseId = courseContext.id;

  const authorizationError = await authorizeMediaWrite({
    organizationId: courseContext.organization_id,
    profileRole: profile?.role,
    supabase,
  });
  if (authorizationError) {
    return authorizationError;
  }

  if (courseContext.organization_id) {
    const [
      entitlementsResult,
      storageUsageResult,
    ] = await Promise.all([
      supabase.rpc("resolve_organization_entitlements", {
        p_organization_id: courseContext.organization_id,
      }),
      supabase.rpc("organization_learning_storage_bytes", {
        p_organization_id: courseContext.organization_id,
      }),
    ]);

    if (entitlementsResult.error || storageUsageResult.error) {
      return jsonError("Could not validate the organisation storage allowance.", 500);
    }

    const entitlements = parseOrganizationEntitlements(entitlementsResult.data);
    const usedStorageBytes = Number(storageUsageResult.data ?? 0);

    if (usedStorageBytes + validation.value.size > entitlements.maxStorageBytes) {
      return jsonError(storageLimitMessage(entitlements.maxStorageBytes), 400);
    }
  }

  const contextId = lessonId ?? courseId;
  const storagePath = buildCmsStoragePath({
    contextId,
    extension: validation.value.extension,
  });
  const bucket = getMediaBucket();
  const uploadResult = await adminSupabase.storage.from(bucket).upload(storagePath, bytes, {
    contentType: validation.value.mimeType,
    upsert: false,
  });

  if (uploadResult.error) {
    return jsonError(uploadResult.error.message, 500);
  }

  const publicUrlResult = adminSupabase.storage.from(bucket).getPublicUrl(storagePath);
  const publicUrl = publicUrlResult.data.publicUrl;
  const metadata = {
    fit: fit === "contain" ? "contain" : "cover",
    height: validation.value.height,
    mimeType: validation.value.mimeType,
    originalName: sanitizePlainTextInput(file.name, 180),
    positionX: Number.isFinite(positionX) ? Math.max(0, Math.min(100, positionX)) : 50,
    positionY: Number.isFinite(positionY) ? Math.max(0, Math.min(100, positionY)) : 50,
    size: validation.value.size,
    uploadedAt: new Date().toISOString(),
    uploadedBy: user.id,
    width: validation.value.width,
  };

  const { data: asset, error: insertError } = await adminSupabase
    .from("learning_media_assets")
    .insert({
      asset_type: assetType,
      caption,
      course_id: courseId,
      generation_status: "completed",
      lesson_id: lessonId,
      metadata,
      placement,
      review_status: "approved",
      source: "uploaded",
      storage_path: storagePath,
      url: publicUrl,
      alt_text: altText,
    })
    .select("id, course_id, lesson_id, asset_type, placement, source, prompt, script, url, storage_path, provider, model, alt_text, caption, metadata, review_status, generation_status, generation_error, sort_order, created_at, updated_at")
    .single();

  if (insertError) {
    await adminSupabase.storage.from(bucket).remove([storagePath]);
    if (insertError.code === "23514") {
      return jsonError(insertError.message, 400);
    }
    return jsonError("The image was uploaded, but the media record could not be saved.", 500);
  }

  return NextResponse.json({ asset });
}

export async function DELETE(request: Request) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return jsonError("Supabase is not configured.", 503);
  }

  const { user, profile } = await getCurrentUserProfile(supabase);
  if (!user) {
    return jsonError("Sign in before deleting media.", 401);
  }

  let assetId = "";
  try {
    const body = await request.json() as { assetId?: unknown };
    assetId = sanitizePlainTextInput(String(body.assetId ?? ""), 80);
  } catch {
    return jsonError("Provide a media asset to delete.", 400);
  }

  if (!assetId) {
    return jsonError("Provide a media asset to delete.", 400);
  }

  let adminSupabase: ReturnType<typeof createSupabaseAdminClient>;
  try {
    adminSupabase = createSupabaseAdminClient();
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Supabase storage is not configured.", 503);
  }

  const { data: asset, error: assetError } = await adminSupabase
    .from("learning_media_assets")
    .select("id, course_id, lesson_id, storage_path")
    .eq("id", assetId)
    .maybeSingle();

  if (assetError) {
    return jsonError("Could not load the media asset.", 500);
  }

  if (!asset) {
    return jsonError("Media asset was not found.", 404);
  }

  const resolvedContext = await resolveMediaCourseContext({
    adminSupabase,
    courseIdInput: asset.course_id,
    lessonIdInput: asset.lesson_id,
  });
  if (resolvedContext.error) {
    return resolvedContext.error;
  }

  const authorizationError = await authorizeMediaWrite({
    organizationId: resolvedContext.courseContext.organization_id,
    profileRole: profile?.role,
    supabase,
  });
  if (authorizationError) {
    return authorizationError;
  }

  if (asset.storage_path) {
    const removeResult = await adminSupabase.storage
      .from(getMediaBucket())
      .remove([asset.storage_path]);

    if (removeResult.error) {
      return jsonError("The storage object could not be deleted.", 500);
    }
  }

  const { error: deleteError } = await adminSupabase
    .from("learning_media_assets")
    .delete()
    .eq("id", asset.id);

  if (deleteError) {
    return jsonError("The media record could not be deleted.", 500);
  }

  return NextResponse.json({ assetId: asset.id, status: "deleted" });
}
