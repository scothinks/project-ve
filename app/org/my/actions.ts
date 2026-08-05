"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createLoginHref } from "@/lib/auth-redirect";
import { sanitizePlainTextInput } from "@/lib/input-safety";
import { createSupabaseServerClient, getCurrentUserProfile } from "@/lib/supabase-server";

function orgMyNotice(message: string) {
  return `/org/my?notice=${encodeURIComponent(message)}`;
}

async function respondToInvitation(formData: FormData, action: "accept" | "decline") {
  const invitationId = sanitizePlainTextInput(String(formData.get("invitationId") ?? ""), 80);
  const supabase = await createSupabaseServerClient();
  const { user } = await getCurrentUserProfile(supabase);

  if (!user || !supabase) {
    redirect(createLoginHref("/org/my"));
  }

  const { error } = await supabase.rpc("respond_organization_invitation", {
    p_action: action,
    p_invitation_id: invitationId,
  });

  if (error) {
    throw error;
  }

  revalidatePath("/org/my");
  revalidatePath("/notifications");
  redirect(orgMyNotice(action === "accept" ? "Invitation accepted." : "Invitation declined."));
}

export async function acceptOrganizationInvitation(formData: FormData) {
  await respondToInvitation(formData, "accept");
}

export async function declineOrganizationInvitation(formData: FormData) {
  await respondToInvitation(formData, "decline");
}
