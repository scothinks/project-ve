import { headers } from "next/headers";
import Link from "next/link";
import { MissionPanel } from "@/components/missions/MissionPanel";
import { AppHeader } from "@/components/navigation/AppHeader";
import { BottomNav } from "@/components/navigation/BottomNav";
import { Card } from "@/components/ui/Card";
import { ExperienceHeader } from "@/components/ui/ExperienceHeader";
import { getOrganizationWorkspaceMissions } from "@/features/organizations/application/learner-workspace";
import { orgHref, requireOrgLearnerRoute, type OrgRouteParams } from "@/app/o/[organizationSlug]/workspace";

function getOrigin(headersList: Headers) {
  const proto = headersList.get("x-forwarded-proto") ?? "http";
  const host = headersList.get("host") ?? "localhost";
  return `${proto}://${host}`;
}

export default async function OrganizationMissionsPage({
  params,
}: {
  params: OrgRouteParams;
}) {
  const { profile, supabase, workspace } = await requireOrgLearnerRoute(params);
  const missions = await getOrganizationWorkspaceMissions({
    origin: getOrigin(await headers()),
    profile,
    supabase,
    workspace,
  });
  const organizationName = workspace.branding.shortName || workspace.branding.name;

  return (
    <main className="mobile-shell min-h-screen bg-[#fffaf4]">
      <AppHeader
        title={`${organizationName} Missions`}
        backHref={orgHref(workspace)}
        className="bg-[#fffaf4] shadow-none"
        showMenu={false}
      />
      <section className="learner-page learner-page--standard">
        <div className="mb-4">
          <Link className="text-sm font-black text-[var(--ve-green)]" href="/missions">
            Return to Project Ve
          </Link>
        </div>
        <ExperienceHeader
          eyebrow="Org Missions"
          subtitle="Programme missions assigned inside this organisation workspace."
          title={`${organizationName} missions`}
          tone="mission"
        />
        <div className="mt-6">
          {missions.length > 0 ? (
            <MissionPanel initialMissions={missions} />
          ) : (
            <Card className="p-5 text-sm font-semibold leading-6 text-[var(--ve-muted-strong)]" variant="quiet">
              No missions are assigned in this organisation workspace yet.
            </Card>
          )}
        </div>
      </section>
      <BottomNav active="Missions" />
    </main>
  );
}
