"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";

function firstFormValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

function interventionStatus(value: string) {
  if (
    value === "open"
    || value === "acknowledged"
    || value === "resolved"
    || value === "dismissed"
  ) {
    return value;
  }

  return "open";
}

function safeRedirect(value: string) {
  return value.startsWith("/admin/interventions") ? value : "/admin/interventions";
}

export async function updateLmsInterventionStatus(formData: FormData) {
  const { supabase } = await requireAdmin();
  const interventionId = firstFormValue(formData.get("interventionId"));
  const status = interventionStatus(firstFormValue(formData.get("status")));
  const note = firstFormValue(formData.get("note")).trim();
  const redirectTo = safeRedirect(firstFormValue(formData.get("redirectTo")));

  if (!interventionId) {
    redirect(`${redirectTo}${redirectTo.includes("?") ? "&" : "?"}notice=Missing%20intervention%20id`);
  }

  const { error } = await supabase.rpc("admin_update_lms_intervention_status", {
    p_intervention_id: interventionId,
    p_note: note || undefined,
    p_status: status,
  });

  if (error) {
    throw error;
  }

  revalidatePath("/admin/interventions");
  redirect(`${redirectTo}${redirectTo.includes("?") ? "&" : "?"}notice=Intervention%20updated`);
}
