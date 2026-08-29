import "server-only";

import { notFound, redirect } from "next/navigation";
import {
  resolveOrganizationLearnerWorkspace,
  type OrganizationLearnerWorkspaceContext,
} from "@/features/organizations/application/learner-workspace";
import { createLoginHref } from "@/lib/auth-redirect";
import { isLiveMode } from "@/lib/app-mode";
import { measureAsync } from "@/lib/performance";
import {
  getCurrentUserContext,
  type CurrentUser,
  type UserProfile,
} from "@/lib/supabase-server";
import type { Database } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

export type OrgLearnerRouteContext = {
  profile: UserProfile;
  supabase: SupabaseClient<Database>;
  user: CurrentUser;
  workspace: OrganizationLearnerWorkspaceContext;
};

export type OrgRouteParams = Promise<{ organizationSlug: string }>;

export async function requireOrgLearnerRoute(params: OrgRouteParams): Promise<OrgLearnerRouteContext> {
  const { organizationSlug } = await params;
  const { supabase, user, profile } = await measureAsync("org.route.auth_profile", () =>
    getCurrentUserContext(),
  );
  const returnPath = `/o/${encodeURIComponent(organizationSlug)}`;

  if (isLiveMode && (!supabase || !user || !profile)) {
    redirect(createLoginHref(returnPath));
  }

  if (!supabase || !user || !profile) {
    notFound();
  }

  const workspace = await measureAsync("org.route.workspace", () =>
    resolveOrganizationLearnerWorkspace(
      supabase,
      organizationSlug,
    ),
  );

  if (!workspace) {
    notFound();
  }

  return {
    profile,
    supabase,
    user,
    workspace,
  };
}

export function orgHref(workspace: OrganizationLearnerWorkspaceContext, path = "") {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `/o/${encodeURIComponent(workspace.organizationSlug)}${suffix === "/" ? "" : suffix}`;
}
