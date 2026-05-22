"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { appendAdminNotice } from "@/lib/admin-feedback";
import { sanitizePlainTextInput } from "@/lib/input-safety";
import type { MissionActionState } from "@/components/admin/MissionEditorForm";

const defaultActionState: MissionActionState = {
  ok: false,
  message: "",
};

function parseOptionalDate(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function parseInteger(value: FormDataEntryValue | null, fallback = 0) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parsePositiveInteger(value: FormDataEntryValue | null, fallback = 1) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function slugifyMissionTitle(title: string) {
  const slug = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);

  return `mission-${slug || "item"}`;
}

async function getUniqueMissionId(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  title: string,
) {
  const baseId = slugifyMissionTitle(title);
  let candidate = baseId;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { data, error } = await supabase
      .from("missions")
      .select("id")
      .eq("id", candidate)
      .maybeSingle<{ id: string }>();

    if (error) throw error;
    if (!data) return candidate;

    candidate = `${baseId}-${Math.random().toString(36).slice(2, 6)}`;
  }

  return `${baseId}-${Date.now().toString(36)}`;
}

function parseMissionPayload(formData: FormData, missionIdOverride?: string) {
  const validationType = sanitizePlainTextInput(
    String(formData.get("validationType") ?? "lesson_completed"),
    64,
  ) as
    | "course_completed"
    | "lesson_completed"
    | "lesson_count_completed"
    | "referral_friend_completed_lessons"
    | "proof_upload"
    | "manual_review";

  let validationConfig: Record<string, unknown> = {};

  switch (validationType) {
    case "course_completed":
      validationConfig = {
        courseId: sanitizePlainTextInput(String(formData.get("courseId") ?? ""), 120),
      };
      break;
    case "lesson_completed":
      validationConfig = {
        lessonId: sanitizePlainTextInput(String(formData.get("lessonId") ?? ""), 120),
      };
      break;
    case "lesson_count_completed":
      validationConfig = {
        count: parsePositiveInteger(formData.get("count"), 1),
        withinDays: String(formData.get("withinDays") ?? "").trim()
          ? parsePositiveInteger(formData.get("withinDays"), 1)
          : undefined,
      };
      break;
    case "referral_friend_completed_lessons":
      validationConfig = {
        requiredFriendLessonCount: parsePositiveInteger(
          formData.get("requiredFriendLessonCount"),
          1,
        ),
        minimumAccountAgeHours: parseInteger(formData.get("minimumAccountAgeHours"), 24),
      };
      break;
    case "proof_upload":
      validationConfig = {
        requiredFields: formData
          .getAll("requiredFields")
          .map((value) => sanitizePlainTextInput(String(value ?? ""), 24))
          .filter(Boolean),
        requirementMode: sanitizePlainTextInput(
          String(formData.get("proofRequirementMode") ?? "all"),
          16,
        ) as "all" | "any",
        requiresManualReview: formData.get("requiresManualReview") === "on",
      };
      break;
    case "manual_review":
      validationConfig = {
        instructions: sanitizePlainTextInput(String(formData.get("instructions") ?? ""), 800),
      };
      break;
  }

  const rewardType = sanitizePlainTextInput(
    String(formData.get("rewardType") ?? "xp"),
    16,
  ) as "xp" | "reward";

  return {
    missionId:
      missionIdOverride
      ?? sanitizePlainTextInput(String(formData.get("missionId") ?? ""), 120),
    title: sanitizePlainTextInput(String(formData.get("title") ?? ""), 140),
    description: sanitizePlainTextInput(String(formData.get("description") ?? ""), 500),
    category: sanitizePlainTextInput(String(formData.get("category") ?? "course"), 32) as
      | "course"
      | "referral"
      | "feedback"
      | "campaign"
      | "custom",
    rewardType,
    rewardXp: rewardType === "xp" ? parsePositiveInteger(formData.get("rewardXp"), 1) : null,
    rewardId:
      rewardType === "reward"
        ? sanitizePlainTextInput(String(formData.get("rewardId") ?? ""), 120)
        : "",
    repeatability: sanitizePlainTextInput(
      String(formData.get("repeatability") ?? "once"),
      32,
    ) as "once" | "daily" | "weekly" | "campaign" | "per_referral",
    validationType,
    validationConfig,
    startsAt: parseOptionalDate(formData.get("startsAt")),
    endsAt: parseOptionalDate(formData.get("endsAt")),
    status: sanitizePlainTextInput(String(formData.get("status") ?? "draft"), 24) as
      | "draft"
      | "published",
    sortOrder: parseInteger(formData.get("sortOrder"), 0),
  };
}

async function callMissionMutationRpc(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  rpcName: "admin_create_mission" | "admin_update_mission",
  payload: ReturnType<typeof parseMissionPayload>,
) {
  return supabase.rpc(rpcName, {
    p_mission_id: payload.missionId,
    p_title: payload.title,
    p_description: payload.description,
    p_category: payload.category,
    p_reward_type: payload.rewardType,
    p_reward_xp: payload.rewardXp,
    p_reward_id: payload.rewardId || null,
    p_repeatability: payload.repeatability,
    p_validation_type: payload.validationType,
    p_validation_config: payload.validationConfig,
    p_starts_at: payload.startsAt,
    p_ends_at: payload.endsAt,
    p_status: payload.status,
    p_sort_order: payload.sortOrder,
  });
}

export async function createMission(
  previousState: MissionActionState = defaultActionState,
  formData: FormData,
): Promise<MissionActionState> {
  void previousState;
  const { supabase } = await requireAdmin();
  const title = sanitizePlainTextInput(String(formData.get("title") ?? ""), 140);
  const missionId = await getUniqueMissionId(supabase, title);
  const payload = parseMissionPayload(formData, missionId);
  const { error } = await callMissionMutationRpc(supabase, "admin_create_mission", payload);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/admin/missions");
  revalidatePath("/missions");
  revalidatePath("/dashboard");
  redirect(appendAdminNotice(`/admin/missions/${missionId}`, "Mission created."));
}

export async function updateMission(
  previousState: MissionActionState = defaultActionState,
  formData: FormData,
): Promise<MissionActionState> {
  void previousState;
  const { supabase } = await requireAdmin();
  const payload = parseMissionPayload(formData);
  const { error } = await callMissionMutationRpc(supabase, "admin_update_mission", payload);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/admin/missions");
  revalidatePath(`/admin/missions/${payload.missionId}`);
  revalidatePath("/missions");
  revalidatePath("/dashboard");
  return { ok: true, message: "Mission saved." };
}

export async function setMissionStatus(formData: FormData) {
  const missionId = sanitizePlainTextInput(String(formData.get("missionId") ?? ""), 120);
  const status = sanitizePlainTextInput(String(formData.get("status") ?? "draft"), 24);
  const redirectTo = sanitizePlainTextInput(String(formData.get("redirectTo") ?? "/admin/missions"), 400);
  const { supabase } = await requireAdmin();

  const { error } = await supabase.rpc("admin_set_mission_status", {
    p_mission_id: missionId,
    p_status: status,
  });

  if (error) {
    throw error;
  }

  revalidatePath("/admin/missions");
  revalidatePath(`/admin/missions/${missionId}`);
  revalidatePath("/missions");
  revalidatePath("/dashboard");

  redirect(
    appendAdminNotice(
      redirectTo,
      status === "published" ? "Mission published." : "Mission moved to draft.",
    ),
  );
}
