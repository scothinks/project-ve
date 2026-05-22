"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { appendAdminNotice } from "@/lib/admin-feedback";
import { sanitizePlainTextInput } from "@/lib/input-safety";

export async function reviewProofSubmission(formData: FormData) {
  const userId = String(formData.get("userId") ?? "");
  const missionId = String(formData.get("missionId") ?? "");
  const awardScope = String(formData.get("awardScope") ?? "");
  const status = String(formData.get("status") ?? "");
  const rejectionReason = sanitizePlainTextInput(
    String(formData.get("rejectionReason") ?? ""),
    500,
  );
  const { supabase } = await requireAdmin();

  if (!userId || !missionId || !awardScope) {
    throw new Error("Proof submission is incomplete.");
  }

  if (status !== "approved" && status !== "rejected") {
    throw new Error("Review status is invalid.");
  }

  const { error } = await supabase.rpc("admin_review_mission_proof_submission", {
    p_user_id: userId,
    p_mission_id: missionId,
    p_award_scope: awardScope,
    p_status: status,
    p_rejection_reason: rejectionReason || null,
  });

  if (error) {
    const maybePostgresError = error as {
      code?: string;
      message?: string;
      details?: string | null;
      hint?: string | null;
    };
    const errorText = [
      maybePostgresError.message,
      maybePostgresError.details,
      maybePostgresError.hint,
    ]
      .filter((value): value is string => Boolean(value))
      .join(" ")
      .toLowerCase();

    const notice =
      maybePostgresError.code === "23514" && errorText.includes("xp_cost_at_redemption")
        ? "Proof review failed because reward redemptions are still blocking zero XP cost awards. Apply the latest Supabase migrations, then retry."
        : maybePostgresError.code === "23514"
          ? "Proof review failed because the database schema is out of date for mission awards. Apply the latest Supabase migrations, then retry."
        : maybePostgresError.message ?? "Proof review failed.";

    redirect(appendAdminNotice("/admin/proofs", notice));
  }

  revalidatePath("/admin");
  revalidatePath("/admin/proofs");
  revalidatePath("/admin/redemptions");
  revalidatePath("/admin/xp-ledger");
  revalidatePath("/admin/users");
  revalidatePath("/missions");
  revalidatePath("/rewards");
  redirect(
    appendAdminNotice(
      "/admin/proofs",
      status === "approved" ? "Proof approved." : "Proof rejected.",
    ),
  );
}
