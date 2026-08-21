import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { sanitizeUploadContext, validateImageUpload } from "@/lib/admin-media-upload";
import { sanitizePlainTextInput } from "@/lib/input-safety";
import type { MissionProof } from "@/lib/missions";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type ValidatedMediaUpload = {
  extension: "jpg" | "png" | "webp" | "mp4" | "webm" | "mov";
  mimeType:
    | "image/jpeg"
    | "image/png"
    | "image/webp"
    | "video/mp4"
    | "video/webm"
    | "video/quicktime";
  size: number;
};

const MAX_MEDIA_BYTES = 10 * 1024 * 1024;
const videoMimeExtensions: Record<string, ValidatedMediaUpload["extension"]> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function getProofMediaBucket() {
  return process.env.MISSION_PROOF_MEDIA_BUCKET || "mission-proof-media";
}

function getFileExtension(fileName: string) {
  const match = fileName.toLowerCase().match(/\.([a-z0-9]+)$/);
  if (!match) {
    return "";
  }

  return match[1] === "jpeg" ? "jpg" : match[1];
}

function validateVideoUpload(file: File, bytes: Uint8Array):
  | { ok: true; value: ValidatedMediaUpload }
  | { ok: false; error: string } {
  const mimeType = file.type.toLowerCase().trim();
  const extension = videoMimeExtensions[mimeType];
  const fileExtension = getFileExtension(file.name);

  if (bytes.byteLength === 0) {
    return { ok: false, error: "Choose a non-empty video file." };
  }

  if (bytes.byteLength > MAX_MEDIA_BYTES) {
    return { ok: false, error: "Video uploads must be 10 MB or smaller." };
  }

  if (!extension) {
    return { ok: false, error: "Upload an MP4, WebM, or MOV video." };
  }

  if (fileExtension && fileExtension !== extension) {
    return { ok: false, error: "The file extension and MIME type do not match." };
  }

  return {
    ok: true,
    value: {
      extension,
      mimeType: mimeType as ValidatedMediaUpload["mimeType"],
      size: bytes.byteLength,
    },
  };
}

function validateProofMediaUpload({
  bytes,
  file,
  proofType,
}: {
  bytes: Uint8Array;
  file: File;
  proofType: MissionProof["type"];
}): { ok: true; value: ValidatedMediaUpload } | { ok: false; error: string } {
  if (proofType === "image") {
    const imageValidation = validateImageUpload({
      bytes,
      fileName: file.name,
      mimeType: file.type,
    });

    if (!imageValidation.ok) {
      return imageValidation;
    }

    return {
      ok: true,
      value: {
        extension: imageValidation.value.extension,
        mimeType: imageValidation.value.mimeType,
        size: imageValidation.value.size,
      },
    };
  }

  if (proofType === "video") {
    return validateVideoUpload(file, bytes);
  }

  return { ok: false, error: "Direct upload is only available for image and video proof." };
}

function buildMissionProofStoragePath({
  extension,
  missionId,
  proofType,
  userId,
}: {
  extension: ValidatedMediaUpload["extension"];
  missionId: string;
  proofType: MissionProof["type"];
  userId: string;
}) {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const safeMissionId = sanitizeUploadContext(missionId, "mission");
  const uploadId = randomUUID().replaceAll("-", "");

  return [
    sanitizeUploadContext(userId, "learner"),
    safeMissionId,
    sanitizeUploadContext(proofType, "proof"),
    year,
    month,
    `${uploadId}.${extension}`,
  ].join("/");
}

export async function POST(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return jsonError("Mission proof upload is unavailable until the live backend is configured.", 503);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonError("Create an account or log in to upload mission proof.", 401);
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const proofType = sanitizePlainTextInput(String(formData.get("type") ?? ""), 20) as MissionProof["type"];

  if (!(file instanceof File)) {
    return jsonError("Choose a media file to upload.", 400);
  }

  if (proofType !== "image" && proofType !== "video") {
    return jsonError("Direct upload is only available for image and video proof.", 400);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const validation = validateProofMediaUpload({ bytes, file, proofType });

  if (!validation.ok) {
    return jsonError(validation.error, 400);
  }

  let adminSupabase: ReturnType<typeof createSupabaseAdminClient>;
  try {
    adminSupabase = createSupabaseAdminClient();
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Supabase storage is not configured.", 503);
  }

  const bucket = getProofMediaBucket();
  const storagePath = buildMissionProofStoragePath({
    extension: validation.value.extension,
    missionId: id,
    proofType,
    userId: user.id,
  });
  const uploadResult = await adminSupabase.storage.from(bucket).upload(storagePath, bytes, {
    contentType: validation.value.mimeType,
    upsert: false,
  });

  if (uploadResult.error) {
    return jsonError(uploadResult.error.message, 500);
  }

  const publicUrlResult = adminSupabase.storage.from(bucket).getPublicUrl(storagePath);

  return NextResponse.json({
    bucket,
    path: storagePath,
    url: publicUrlResult.data.publicUrl,
  });
}
