import { NextResponse } from "next/server";
import { getOrganizationWorkspaceRewardSnapshot } from "@/features/organizations/application/learner-workspace";
import { requireOrgLearnerRoute } from "@/app/o/[organizationSlug]/workspace";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ organizationSlug: string }> },
) {
  try {
    const { organizationSlug } = await params;
    const { supabase, user, workspace } = await requireOrgLearnerRoute(
      Promise.resolve({ organizationSlug }),
    );
    const snapshot = await getOrganizationWorkspaceRewardSnapshot({
      supabase,
      userId: user.id,
      workspace,
    });
    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load organisation rewards." },
      { status: 403 },
    );
  }
}
