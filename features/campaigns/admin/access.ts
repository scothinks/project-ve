import "server-only";

import { redirect } from "next/navigation";
import { requireAdminWorkspaceRole } from "@/features/admin/application/context";
import { PLATFORM_CATALOG_WORKSPACE_ID } from "@/features/admin/shared/workspace";

const REWARD_CAMPAIGN_ROLES = [
  "platform_admin",
  "organisation_owner",
  "organisation_admin",
  "programme_manager",
];

export async function requirePlatformRewardCampaignManager() {
  const context = await requireAdminWorkspaceRole(REWARD_CAMPAIGN_ROLES);

  if (context.workspace.type !== "platform" && context.workspace.id !== PLATFORM_CATALOG_WORKSPACE_ID) {
    redirect("/admin");
  }

  return context;
}
