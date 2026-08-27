"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createLoginHref } from "@/lib/auth-redirect";
import { sanitizePlainTextInput } from "@/lib/input-safety";
import { createSupabaseServerClient, getCurrentUserProfile } from "@/lib/supabase-server";

function orgMyNotice(message: string, joinedOrgSlug?: string) {
  const params = new URLSearchParams({ notice: message });
  if (joinedOrgSlug) {
    params.set("joinedOrg", joinedOrgSlug);
  }
  return `/org/my?${params.toString()}`;
}

function orgMyError(message: string) {
  return `/org/my?${new URLSearchParams({ error: message }).toString()}`;
}

const KNOWN_INVITATION_ERROR_MESSAGES: Record<string, string> = {
  "Organisation is not available.": "This org is no longer available.",
  "Invitation has expired.": "This invitation has expired.",
  "Invitation is no longer available.": "This invitation is no longer available.",
  "Invitation already accepted.": "This invitation has already been used.",
  "Invitation not found.": "We couldn't find that invitation.",
};

async function respondToInvitation(formData: FormData, action: "accept" | "decline") {
  const invitationId = sanitizePlainTextInput(String(formData.get("invitationId") ?? ""), 80);
  const organizationSlug = sanitizePlainTextInput(String(formData.get("organizationSlug") ?? ""), 80);
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
    const friendlyMessage = KNOWN_INVITATION_ERROR_MESSAGES[error.message];
    if (friendlyMessage) {
      revalidatePath("/org/my");
      redirect(orgMyError(friendlyMessage));
    }
    throw error;
  }

  revalidatePath("/org/my");
  revalidatePath("/notifications");
  redirect(
    orgMyNotice(
      action === "accept" ? "Invitation accepted." : "Invitation declined.",
      action === "accept" ? organizationSlug : undefined,
    ),
  );
}

export async function acceptOrganizationInvitation(formData: FormData) {
  await respondToInvitation(formData, "accept");
}

export async function declineOrganizationInvitation(formData: FormData) {
  await respondToInvitation(formData, "decline");
}
