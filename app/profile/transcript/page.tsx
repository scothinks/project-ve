import { redirect } from "next/navigation";
import { AppHeader } from "@/components/navigation/AppHeader";
import { BottomNav } from "@/components/navigation/BottomNav";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import {
  getLearnerTranscript,
  type LearnerTranscriptItem,
} from "@/features/completions/learner/data";
import { withLoggedFallback } from "@/lib/app-errors";
import { isLiveMode } from "@/lib/app-mode";
import {
  createSupabaseServerClient,
  getCurrentUserProfile,
} from "@/lib/supabase-server";

function formatDate(value: string | null) {
  if (!value) {
    return "Not completed";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not completed";
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function requirementCount(value: unknown): number {
  return Array.isArray(value) ? value.length : value ? 1 : 0;
}

function missingRequirementCount(item: LearnerTranscriptItem): number {
  return Object.values(item.missingRequirements).reduce<number>(
    (total, value) => total + requirementCount(value),
    0,
  );
}

function TranscriptCard({ item }: { item: LearnerTranscriptItem }) {
  const isComplete = item.status === "completed";
  const missingCount = missingRequirementCount(item);

  return (
    <Card className="overflow-hidden rounded-[20px]" variant="quiet">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">
              {item.kind}
            </p>
            <h2 className="mt-1 text-base font-black leading-snug text-[var(--foreground)]">
              {item.title}
            </h2>
            {item.category ? (
              <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">{item.category}</p>
            ) : null}
          </div>
          <span
            className={
              isComplete
                ? "rounded-full bg-[var(--ve-green-soft)] px-3 py-1 text-xs font-black text-[var(--ve-green)]"
                : "rounded-full bg-[var(--ve-panel-soft)] px-3 py-1 text-xs font-black text-[var(--ve-muted-strong)]"
            }
          >
            {isComplete ? "Completed" : "In progress"}
          </span>
        </div>

        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-[var(--ve-panel-soft)]">
            <div
              className="h-full rounded-full bg-[var(--ve-green)]"
              style={{ width: `${item.progressPercent}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs font-bold text-[var(--ve-muted)]">
            <span>{item.progressPercent}% complete</span>
            <span>{formatDate(item.completedAt)}</span>
          </div>
        </div>

        {!isComplete && missingCount > 0 ? (
          <p className="mt-3 rounded-[14px] bg-[var(--ve-panel)] px-3 py-2 text-xs font-semibold leading-5 text-[var(--ve-muted-strong)]">
            {missingCount} requirement{missingCount === 1 ? "" : "s"} remaining
          </p>
        ) : null}
      </div>
    </Card>
  );
}

function TranscriptSection({
  emptyText,
  items,
  title,
}: {
  emptyText: string;
  items: LearnerTranscriptItem[];
  title: string;
}) {
  return (
    <section className="mt-6">
      <h2 className="text-sm font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">{title}</h2>
      <div className="mt-3 space-y-3">
        {items.length > 0 ? (
          items.map((item) => <TranscriptCard item={item} key={`${item.kind}-${item.id}`} />)
        ) : (
          <Card className="rounded-[20px] p-4 text-sm font-semibold leading-6 text-[var(--ve-muted)]" variant="quiet">
            {emptyText}
          </Card>
        )}
      </div>
    </section>
  );
}

export default async function LearnerTranscriptPage() {
  const supabase = await createSupabaseServerClient();
  const { user } = await getCurrentUserProfile(supabase);

  if (isLiveMode && !user) {
    redirect("/login");
  }

  const transcript = supabase && user
    ? await withLoggedFallback({
      context: {
        operation: "profile.transcript.load",
        userId: user.id,
      },
      fallback: {
        courses: [],
        generatedAt: null,
        programmes: [],
      },
      promise: getLearnerTranscript(supabase),
    })
    : {
      courses: [],
      generatedAt: null,
      programmes: [],
    };

  const completedCount = [...transcript.courses, ...transcript.programmes]
    .filter((item) => item.status === "completed")
    .length;

  return (
    <main className="mobile-shell min-h-screen bg-[var(--ve-card)]">
      <AppHeader title="Transcript" backHref="/profile" showMenu={false} />
      <section className="learner-page learner-page--standard pb-28">
        <SectionHeader
          eyebrow="Learning record"
          subtitle="Course and programme completion records refresh from your assigned learning."
        />

        <Card className="mt-5 rounded-[20px] p-4" variant="quiet">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">Completed</p>
          <p className="mt-2 text-3xl font-black text-[var(--foreground)]">{completedCount}</p>
          <p className="mt-1 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
            Certificates are not issued in this P1 ticket.
          </p>
        </Card>

        <TranscriptSection
          emptyText="Assigned course completions will appear here."
          items={transcript.courses}
          title="Courses"
        />
        <TranscriptSection
          emptyText="Assigned programme completions will appear here."
          items={transcript.programmes}
          title="Programmes"
        />

        <div className="mt-6">
          <Button className="w-full" href="/courses" variant="soft">
            Open course library
          </Button>
        </div>
      </section>
      <BottomNav active="Home" />
    </main>
  );
}
