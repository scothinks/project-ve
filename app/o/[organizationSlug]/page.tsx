import Link from "next/link";
import { AppHeader } from "@/components/navigation/AppHeader";
import { BottomNav } from "@/components/navigation/BottomNav";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { orgHref, requireOrgLearnerRoute, type OrgRouteParams } from "@/app/o/[organizationSlug]/workspace";

export default async function OrganizationLearnerHomePage({
  params,
}: {
  params: OrgRouteParams;
}) {
  const { workspace } = await requireOrgLearnerRoute(params);
  const organizationName = workspace.branding.shortName || workspace.branding.name;

  return (
    <main className="mobile-shell min-h-screen bg-[var(--ve-shell)]">
      <AppHeader title={organizationName} backHref="/org/my" showMenu={false} />
      <section className="learner-page learner-page--standard pb-28">
        <div className="mb-4">
          <Link className="text-sm font-black text-[var(--ve-green)]" href="/dashboard">
            Return to Project Ve
          </Link>
        </div>
        <SectionHeader
          eyebrow="Org Mode"
          subtitle={`Your active learner workspace is ${organizationName}. This view only shows learning connected to this organisation.`}
        />

        <Card className="mt-5 p-5" variant="lesson">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">
            Access source
          </p>
          <p className="mt-2 text-2xl font-black text-[var(--foreground)]">
            {workspace.accessSource.replaceAll("_", " ")}
          </p>
          <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted-strong)]">
            {workspace.programmeIds.length} programme{workspace.programmeIds.length === 1 ? "" : "s"} and{" "}
            {workspace.courseIds.length} course{workspace.courseIds.length === 1 ? "" : "s"} are available in this workspace.
          </p>
        </Card>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Button href={orgHref(workspace, "/learn")} variant="soft">Open learning workspace</Button>
          <Button href={orgHref(workspace, "/missions")} variant="outline">Missions</Button>
          <Button href={orgHref(workspace, "/rewards")} variant="outline">Rewards</Button>
          <Button href={orgHref(workspace, "/profile")} variant="outline">Profile</Button>
        </div>
      </section>
      <BottomNav active="Home" />
    </main>
  );
}
