import { headers } from "next/headers";
import { NextResponse } from "next/server";
import {
  getOrganizationWorkspaceMissions,
  resolveOrganizationLearnerWorkspace,
} from "@/features/organizations/application/learner-workspace";
import { createSupabaseServerClient, getCurrentUserProfile } from "@/lib/supabase-server";

function getOrigin(headersList: Headers) {
  const proto = headersList.get("x-forwarded-proto") ?? "http";
  const host = headersList.get("host") ?? "localhost";
  return `${proto}://${host}`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ organizationSlug: string }> },
) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json({ error: "Organization missions are unavailable." }, { status: 503 });
  }

  const { profile } = await getCurrentUserProfile(supabase);

  if (!profile) {
    return NextResponse.json({ error: "Sign in to view organization missions." }, { status: 401 });
  }

  const { organizationSlug } = await params;
  const workspace = await resolveOrganizationLearnerWorkspace(
    supabase,
    profile.id,
    profile,
    organizationSlug,
  );

  if (!workspace) {
    return NextResponse.json({ error: "Organization workspace not found." }, { status: 404 });
  }

  const missions = await getOrganizationWorkspaceMissions({
    origin: getOrigin(await headers()),
    profile,
    supabase,
    workspace,
  });

  return NextResponse.json({ missions });
}
