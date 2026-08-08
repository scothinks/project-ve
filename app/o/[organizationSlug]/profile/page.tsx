import Link from "next/link";
import { AppHeader } from "@/components/navigation/AppHeader";
import { BottomNav } from "@/components/navigation/BottomNav";
import { Avatar } from "@/components/profile/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { orgHref, requireOrgLearnerRoute, type OrgRouteParams } from "@/app/o/[organizationSlug]/workspace";

function roleLabel(role: string) {
  return role
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default async function OrganizationProfilePage({
  params,
}: {
  params: OrgRouteParams;
}) {
  const { profile, workspace } = await requireOrgLearnerRoute(params);
  const organizationName = workspace.branding.shortName || workspace.branding.name;

  return (
    <main className="mobile-shell min-h-screen bg-[var(--ve-card)]">
      <AppHeader title={`${organizationName} Profile`} backHref={orgHref(workspace)} showMenu={false} />
      <section className="learner-page learner-page--standard pb-28">
        <div className="mb-4">
          <Link className="text-sm font-black text-[var(--ve-green)]" href="/profile">
            Return to Project Ve
          </Link>
        </div>
        <SectionHeader
          eyebrow="Org profile"
          subtitle="This profile view is scoped to the active organisation workspace."
        />

        <Card className="mt-5 p-5" variant="quiet">
          <div className="flex items-center gap-4">
            <Avatar
              avatarUrl={profile.avatar_url ?? ""}
              className="size-16"
              name={profile.display_name ?? ""}
            />
            <div className="min-w-0">
              <h1 className="text-2xl font-black text-[var(--foreground)]">
                {profile.display_name || "Project Ve learner"}
              </h1>
              <p className="mt-1 text-sm font-semibold text-[var(--ve-muted)]">
                {workspace.accessSource.replaceAll("_", " ")}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[16px] bg-[var(--ve-panel)] p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">
                Programmes
              </p>
              <p className="mt-2 text-2xl font-black text-[var(--foreground)]">{workspace.programmeIds.length}</p>
            </div>
            <div className="rounded-[16px] bg-[var(--ve-panel)] p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">
                Courses
              </p>
              <p className="mt-2 text-2xl font-black text-[var(--foreground)]">{workspace.courseIds.length}</p>
            </div>
          </div>

          {workspace.membershipRoles.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {workspace.membershipRoles.map((role) => (
                <span
                  className="rounded-full bg-[var(--ve-card)] px-3 py-1 text-[11px] font-black text-[var(--ve-muted)]"
                  key={role}
                >
                  {roleLabel(role)}
                </span>
              ))}
            </div>
          ) : null}
        </Card>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Button href={orgHref(workspace, "/transcript")} variant="soft">Open transcript</Button>
          <Button href={orgHref(workspace, "/learn")} variant="outline">Open learning</Button>
          <Button href={orgHref(workspace, "/notifications")} variant="outline">Notifications</Button>
        </div>
      </section>
      <BottomNav active="Profile" />
    </main>
  );
}
