import "server-only";
import { getSelectedAdminWorkspaceId, requireAdmin } from "@/features/admin/application/context";
import { PLATFORM_CATALOG_WORKSPACE_ID } from "@/features/admin/shared/workspace";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function mediaRequestContext() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  const workspace = await getSelectedAdminWorkspaceId();
  const organizationId = workspace === "platform" || workspace === PLATFORM_CATALOG_WORKSPACE_ID ? null : workspace;
  if (organizationId && !/^[a-f0-9-]{36}$/.test(organizationId)) throw new Error("Select a valid workspace.");
  return { supabase, organizationId };
}
export async function requireMediaEditor() {
  const { supabase, workspace } = await requireAdmin();
  const organizationId = workspace.id === "platform" || workspace.id === PLATFORM_CATALOG_WORKSPACE_ID ? null : workspace.id;
  const context = { supabase, organizationId };
  const { data, error } = await context.supabase.rpc("media_workspace_permissions", { p_organization_id: context.organizationId ?? undefined });
  const permissions = data as { canEdit?: boolean; canManage?: boolean } | null;
  if (error || !permissions?.canEdit) throw new Error("Media editor access is required in the selected workspace.");
  return { ...context, canManage: permissions.canManage === true };
}
