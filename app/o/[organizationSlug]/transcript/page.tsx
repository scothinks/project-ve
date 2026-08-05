import Link from "next/link";
import { AppHeader } from "@/components/navigation/AppHeader";
import { BottomNav } from "@/components/navigation/BottomNav";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import {
  filterTranscriptForOrganizationWorkspace,
} from "@/features/organizations/application/learner-workspace";
import { getLearnerTranscript, type LearnerTranscriptItem } from "@/features/completions/learner/data";
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
            {item.kind}
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

export default async function OrganizationTranscriptPage({
  params,
}: {
  params: OrgRouteParams;
}) {
  const { supabase, user, workspace } = await requireOrgLearnerRoute(params);
  const organizationName = workspace.branding.shortName || workspace.branding.name;
  const transcript = supabase && user
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
    : {
        courses: [],
        generatedAt: null,
        programmes: [],
      };
  const items = [...transcript.programmes, ...transcript.courses];
  const completedCount = items.filter((item) => item.status === "completed").length;

  return (
    <main className="mobile-shell min-h-screen bg-[var(--ve-card)]">
      <AppHeader title={`${organizationName} Transcript`} backHref={orgHref(workspace, "/profile")} showMenu={false} />
      <section className="learner-page learner-page--standard pb-28">
        <div className="mb-4">
          <Link className="text-sm font-black text-[var(--ve-green)]" href="/profile/transcript">
            Return to Project Ve
          </Link>
        </div>
        <SectionHeader
          eyebrow="Org transcript"
          subtitle="Course and programme completion records for this organisation workspace."
        />

        <Card className="mt-5 p-4" variant="quiet">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">
            Completed
          </p>
          <p className="mt-2 text-3xl font-black text-[var(--foreground)]">{completedCount}</p>
        </Card>

        <div className="mt-5 space-y-3">
          {items.length > 0 ? (
            items.map((item) => <TranscriptItemCard item={item} key={`${item.kind}-${item.id}`} />)
          ) : (
            <Card className="p-4 text-sm font-semibold leading-6 text-[var(--ve-muted)]" variant="quiet">
              Organisation transcript records will appear here once assigned learning is in progress.
            </Card>
          )}
        </div>

        <div className="mt-6">
          <Button className="w-full" href={orgHref(workspace, "/learn")} variant="soft">
            Open organisation learning
          </Button>
        </div>
      </section>
      <BottomNav active="Home" />
    </main>
  );
}
