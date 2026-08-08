"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_WORKSPACE_COOKIE } from "@/features/admin/application/context";
import {
  createSelfServiceOrganizationRedirect,
  parseSelfServiceOrganizationInput,
} from "@/features/organizations/application/self-service";
import { createSupabaseServerClient, getCurrentUserProfile } from "@/lib/supabase-server";

function organizationIdFromRpcResult(value: unknown) {
  if (!value || typeof value !== "object" || !("organizationId" in value)) {
    return null;
  }

  const organizationId = (value as { organizationId?: unknown }).organizationId;
  return typeof organizationId === "string" ? organizationId : null;
}

export async function createSelfServiceOrganization(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    redirect(createSelfServiceOrganizationRedirect("/org/create", "Organisation creation is unavailable."));
  }

  const { user, profile } = await getCurrentUserProfile(supabase);

  if (!user) {
    redirect("/login?next=/org/create");
  }

  if (!profile) {
    redirect("/dashboard");
  }

  let input;

  try {
    input = parseSelfServiceOrganizationInput(formData);
  } catch (error) {
    redirect(
      createSelfServiceOrganizationRedirect(
        "/org/create",
        error instanceof Error ? error.message : "Check the organisation details and try again.",
      ),
    );
  }

  const { data, error } = await supabase.rpc("create_self_service_organization", {
    p_description: input.description,
    p_name: input.name,
    p_short_name: input.shortName,
    p_slug: input.slug,
    p_support_email: input.supportEmail,
    p_terms_accepted: input.termsAccepted,
  });

  if (error) {
    redirect(createSelfServiceOrganizationRedirect("/org/create", error.message));
  }

  const organizationId = organizationIdFromRpcResult(data);

  if (!organizationId) {
    redirect(createSelfServiceOrganizationRedirect("/org/create", "Organisation was created without a workspace id."));
  }

  (await cookies()).set(ADMIN_WORKSPACE_COOKIE, organizationId, {
    path: "/admin",
    sameSite: "lax",
  });

  revalidatePath("/admin");
  revalidatePath("/admin/organizations");
  revalidatePath("/org/create");
  revalidatePath("/org/my");

  redirect("/admin?notice=Organisation%20created.%20Continue%20setup%20in%20your%20new%20workspace.");
}
