import { LearnerWorkspaceSwitcher } from "@/components/navigation/LearnerWorkspaceSwitcher";
import { OrgBottomNav, OrgLearnerChrome } from "@/components/organizations/OrgLearnerMobile";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  filterTranscriptForOrganizationWorkspace,
} from "@/features/organizations/application/learner-workspace";
import { getLearnerTranscript, type LearnerTranscriptItem } from "@/features/completions/learner/data";
import { getMyOrganizationState } from "@/features/organizations/application/my-orgs";
import { withLoggedFallback } from "@/lib/app-errors";
import { orgHref, requireOrgLearnerRoute, type OrgRouteParams } from "@/app/o/[organizationSlug]/workspace";

function formatDate(value: string | null) {
  if (!value) return "Not completed";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not completed";

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function TranscriptItemCard({ item }: { item: LearnerTranscriptItem }) {
  const complete = item.status === "completed";

  return (
    <Card className="p-4" variant="quiet">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">
            {item.kind === "programme" ? "Programme" : "Course"}
          </p>
          <h2 className="mt-1 text-base font-black leading-snug text-[var(--foreground)]">
            {item.title}
          </h2>
        </div>
        <span
          className={
            complete
              ? "rounded-full bg-[var(--ve-green-soft)] px-3 py-1 text-xs font-black text-[var(--ve-green)]"
              : "rounded-full bg-[var(--ve-panel)] px-3 py-1 text-xs font-black text-[var(--ve-muted-strong)]"
          }
        >
          {complete ? "Completed" : "In progress"}
        </span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--ve-panel)]">
        <div className="h-full rounded-full bg-[var(--ve-green)]" style={{ width: `${item.progressPercent}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs font-bold text-[var(--ve-muted)]">
        <span>{item.progressPercent}% complete</span>
        <span>{formatDate(item.completedAt)}</span>
      </div>
    </Card>
  );
}

function TranscriptSection({ items, title }: { items: LearnerTranscriptItem[]; title: string }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="org-transcript-section">
      <h2 className="text-[0.78rem] font-black uppercase tracking-[0.14em] text-[var(--ve-muted-strong)]">
        {title}
      </h2>
      <div className="mt-3 space-y-3">
        {items.map((item) => (
          <TranscriptItemCard item={item} key={`${item.kind}-${item.id}`} />
        ))}
      </div>
    </section>
  );
}

export default async function OrganizationTranscriptPage({
  params,
}: {
  params: OrgRouteParams;
}) {
  const { supabase, user, workspace } = await requireOrgLearnerRoute(params);
  const organizationName = workspace.branding.shortName || workspace.branding.name;
  const [transcript, myOrgsState] = await Promise.all([
    supabase && user
      ? filterTranscriptForOrganizationWorkspace(
          await withLoggedFallback({
            context: {
              operation: "org_workspace.transcript.load",
              resourceId: workspace.organizationId,
              userId: user.id,
            },
            fallback: {
              courses: [],
              generatedAt: null,
              programmes: [],
            },
            promise: getLearnerTranscript(supabase),
          }),
          workspace,
        )
      : Promise.resolve({
          courses: [],
          generatedAt: null,
          programmes: [],
        }),
    getMyOrganizationState(supabase, user.id),
  ]);
  const hasItems = transcript.programmes.length > 0 || transcript.courses.length > 0;

  return (
    <main className="learner-system orgs-learner min-h-screen">
      <OrgLearnerChrome
        active="Home"
        balance={workspace.xpAccount.balance}
        logoUrl={workspace.branding.logoUrl}
        organizationName={organizationName}
        organizationSlug={workspace.organizationSlug}
        pointsLabel={workspace.xpAccount.label}
        workspaceSwitcher={
          <LearnerWorkspaceSwitcher
            currentOrganizationSlug={workspace.organizationSlug}
            organizations={myOrgsState.organizations}
          />
        }
      />
      <section className="learner-page learner-page--standard pb-28">
        <div>
          <h1 className="text-[1.55rem] font-black tracking-[-0.02em] text-[var(--foreground)]">
            Learning Transcript
          </h1>
          <p className="mt-1 text-sm font-semibold text-[var(--ve-muted)]">{organizationName}</p>
        </div>

        <div className="mt-4">
          <Button className="w-full" href={orgHref(workspace, "/learn")} variant="soft">
            Go to Organisation Learning
          </Button>
        </div>

        {hasItems ? (
          <div className="org-transcript-grid mt-6">
            <TranscriptSection items={transcript.programmes} title="Programmes" />
            <TranscriptSection items={transcript.courses} title="Courses" />
          </div>
        ) : (
          <Card className="mt-6 p-4 text-sm font-semibold leading-6 text-[var(--ve-muted)]" variant="quiet">
            Organisation transcript records will appear here once assigned learning is in progress.
          </Card>
        )}
      </section>
      <OrgBottomNav active="Home" organizationSlug={workspace.organizationSlug} />
    </main>
  );
}
