import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminMissionRewardRow = {
  id: string;
  title: string;
  fulfillment_type: string;
};

export type AdminRewardCandidateRow = {
  id: string;
  title: string;
  distribution_mode: string;
  fulfillment_type: string;
  status: string;
  is_enabled: boolean;
  visibility_mode: string;
  total_available?: number;
  direct_available?: number;
  assigned_available?: number;
};

type LegacyAdminRewardRow = Omit<AdminRewardCandidateRow, "distribution_mode">;

export type AdminMissionRow = {
  id: string;
  title: string;
  description: string;
  category: string;
  reward_type: "xp" | "reward";
  reward_xp: number | null;
  reward_id: string | null;
  reward?: AdminMissionRewardRow | null;
  repeatability: string;
  validation_type: string;
  validation_config: Record<string, unknown>;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  sort_order: number;
};

export type AdminProofRow = {
  id: string;
  user_id: string;
  mission_id: string;
  award_scope: string;
  proof_type: string;
  value: string;
  status: "submitted" | "approved" | "rejected";
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
};

export type AdminProofProfileRow = {
  id: string;
  display_name: string | null;
  referral_code: string | null;
  xp_balance_cached: number;
  role: string;
  created_at: string;
  redemption_unlocked_at: string | null;
  fraud_review_status: string;
};

export type AdminProofSubmission = {
  key: string;
  userId: string;
  missionId: string;
  awardScope: string;
  status: "submitted" | "approved" | "rejected";
  createdAt: string;
  reviewedAt: string | null;
  proofs: AdminProofRow[];
  profile?: AdminProofProfileRow;
  mission?: AdminMissionRow;
};

function withDerivedDistributionMode<T extends { fulfillment_type: string }>(
  reward: T,
): T & { distribution_mode: string; fulfillment_type: string } {
  return {
    ...reward,
    distribution_mode: reward.fulfillment_type === "perk_bundle" ? "perk_bundle" : "direct",
    fulfillment_type: reward.fulfillment_type === "perk_bundle" ? "manual" : reward.fulfillment_type,
  };
}

function isMissingDistributionModeError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const record = error as Record<string, unknown>;
  return /distribution_mode/i.test(String(record.message ?? ""));
}

async function getProfilesByIds(
  supabase: SupabaseClient,
  userIds: Array<string | null | undefined>,
) {
  const uniqueIds = Array.from(new Set(userIds)).filter(
    (userId): userId is string => typeof userId === "string" && userId.length > 0,
  );

  if (uniqueIds.length === 0) {
    return new Map<string, AdminProofProfileRow>();
  }

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, display_name, referral_code, xp_balance_cached, role, created_at, redemption_unlocked_at, fraud_review_status",
    )
    .in("id", uniqueIds);

  if (error) {
    throw error;
  }

  return new Map(((data ?? []) as AdminProofProfileRow[]).map((profile) => [profile.id, profile]));
}

export async function getAdminMissions(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("missions")
    .select(
      "id, title, description, category, reward_type, reward_xp, reward_id, repeatability, validation_type, validation_config, status, starts_at, ends_at, sort_order, reward:rewards!missions_reward_id_fkey(id, title, fulfillment_type)",
    )
    .order("sort_order", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as unknown as AdminMissionRow[];
}

export async function getAdminMission(supabase: SupabaseClient, missionId: string) {
  const { data, error } = await supabase
    .from("missions")
    .select(
      "id, title, description, category, reward_type, reward_xp, reward_id, repeatability, validation_type, validation_config, status, starts_at, ends_at, sort_order, reward:rewards!missions_reward_id_fkey(id, title, fulfillment_type)",
    )
    .eq("id", missionId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as unknown as AdminMissionRow | null;
}

export async function getAdminMissionRewardCandidates(supabase: SupabaseClient) {
  const candidatesResult = await supabase
    .from("rewards")
    .select("id, title, fulfillment_type, visibility_mode, distribution_mode, status, is_enabled, total_available")
    .order("title", { ascending: true });

  if (candidatesResult.error) {
    if (!isMissingDistributionModeError(candidatesResult.error)) {
      throw candidatesResult.error;
    }

    const legacyCandidatesResult = await supabase
      .from("rewards")
      .select("id, title, fulfillment_type, visibility_mode, status, is_enabled, total_available")
      .order("title", { ascending: true });

    if (legacyCandidatesResult.error) {
      throw legacyCandidatesResult.error;
    }

    return ((legacyCandidatesResult.data ?? []) as LegacyAdminRewardRow[])
      .map(withDerivedDistributionMode)
      .filter((candidate) => candidate.distribution_mode !== "perk_bundle");
  }

  return ((candidatesResult.data ?? []) as AdminRewardCandidateRow[]).filter(
    (candidate) => candidate.distribution_mode !== "perk_bundle",
  );
}

export async function getAdminProofSubmissions(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("mission_proofs")
    .select(
      "id, user_id, mission_id, award_scope, proof_type, value, status, rejection_reason, created_at, reviewed_at",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    throw error;
  }

  const proofs = (data ?? []) as AdminProofRow[];
  const [profiles, missions] = await Promise.all([
    getProfilesByIds(
      supabase,
      proofs.map((proof) => proof.user_id),
    ),
    getAdminMissions(supabase),
  ]);
  const missionMap = new Map(missions.map((mission) => [mission.id, mission]));
  const grouped = new Map<string, AdminProofSubmission>();

  for (const proof of proofs) {
    const key = `${proof.user_id}:${proof.mission_id}:${proof.award_scope}`;
    const existing = grouped.get(key);
    const nextStatus =
      proof.status === "rejected"
        ? "rejected"
        : existing?.status === "rejected"
          ? "rejected"
          : proof.status === "submitted"
            ? "submitted"
            : existing?.status ?? "approved";

    grouped.set(key, {
      key,
      userId: proof.user_id,
      missionId: proof.mission_id,
      awardScope: proof.award_scope,
      status: nextStatus,
      createdAt: existing?.createdAt ?? proof.created_at,
      reviewedAt: proof.reviewed_at ?? existing?.reviewedAt ?? null,
      proofs: [...(existing?.proofs ?? []), proof],
      profile: profiles.get(proof.user_id),
      mission: missionMap.get(proof.mission_id),
    });
  }

  return Array.from(grouped.values()).map((submission) => {
    const submittedProofs = submission.proofs.filter((proof) => proof.status === "submitted");
    const rejectedProofs = submission.proofs.filter((proof) => proof.status === "rejected");
    const approvedProofs = submission.proofs.filter((proof) => proof.status === "approved");

    if (submittedProofs.length > 0) {
      return {
        ...submission,
        status: "submitted",
        createdAt: submittedProofs[0]?.created_at ?? submission.createdAt,
        reviewedAt: null,
        proofs: submittedProofs,
      };
    }

    if (rejectedProofs.length > 0) {
      return {
        ...submission,
        status: "rejected",
        proofs: rejectedProofs,
      };
    }

    return {
      ...submission,
      status: "approved",
      proofs: approvedProofs.length > 0 ? approvedProofs : submission.proofs,
    };
  });
}
