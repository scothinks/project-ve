import { redirect } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import { BottomNav } from "@/components/navigation/BottomNav";
import { LearnerTopChrome } from "@/components/navigation/LearnerTopChrome";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ArrowLeftIcon, BookOpenIcon, BuildingIcon, ChevronRightIcon } from "@/components/ui/Icons";
import {
  getLearnerTranscript,
  type LearnerTranscriptItem,
} from "@/features/completions/learner/data";
import { withLoggedFallback } from "@/lib/app-errors";
import { isLiveMode } from "@/lib/app-mode";
import { getUnreadNotificationCount } from "@/lib/notifications";
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
  const kindLabel = item.kind === "programme" ? "Programme" : "Course";

  return (
    <Card className="overflow-hidden rounded-[8px] border-[var(--ve-line-soft)] bg-[var(--ve-card-muted)] shadow-[0_8px_20px_rgba(var(--ve-shadow-rgb),0.04)] lg:bg-[var(--ve-card-subtle)] lg:shadow-[0_18px_44px_rgba(var(--ve-shadow-rgb),0.06)]">
      <div className="relative p-4 pb-5">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-semibold leading-6 tracking-[-0.02em] text-[var(--foreground)] lg:text-[1.35rem] lg:leading-7">
                {item.title}
              </h3>
              <span className="shrink-0 rounded-full bg-[var(--ve-green-soft)] px-2 py-1 text-[10px] font-black text-[#8a6a16]">
                {kindLabel}
              </span>
            </div>
            {item.category ? (
              <p className="mt-2 text-sm font-semibold leading-5 text-[var(--ve-muted-strong)]">
                {item.category}
              </p>
            ) : null}
          </div>
          {isComplete ? <ChevronRightIcon className="mt-1 h-5 w-5 shrink-0 text-[var(--ve-muted-soft)]" /> : null}
        </div>

        {isComplete ? (
          <p className="mt-4 text-sm font-semibold text-[var(--ve-muted-strong)]">
            Completed - {formatDate(item.completedAt)}
          </p>
        ) : (
          <div className="mt-5">
            <div className="flex items-center justify-between text-sm font-black">
              <span className="text-[var(--ve-green)]">In progress</span>
              <span className="text-[color:color-mix(in_srgb,var(--ve-green)_76%,var(--foreground))]">
                {item.progressPercent}%
              </span>
            </div>
            {missingCount > 0 ? (
              <p className="mt-1 text-xs font-black text-[var(--ve-muted-strong)]">
                {missingCount} requirement{missingCount === 1 ? "" : "s"} remaining
              </p>
            ) : null}
            <div className="absolute inset-x-0 bottom-0 h-2 overflow-hidden bg-[var(--ve-line-soft)]">
              <div
                className="h-full bg-[var(--ve-green)]"
                style={{ width: `${item.progressPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function TranscriptSection({
  emptyText,
  icon,
  items,
  title,
}: {
  emptyText: string;
  icon: ReactNode;
  items: LearnerTranscriptItem[];
  title: string;
}) {
  return (
    <section className="mt-6 lg:mt-0">
      <div className="flex items-center gap-2">
        <span className="grid size-5 place-items-center text-[var(--ve-green)]">{icon}</span>
        <h2 className="text-xl font-semibold text-[var(--foreground)]">{title}</h2>
      </div>
      <div className="mt-3 space-y-3 lg:space-y-4">
        {items.length > 0 ? (
          items.map((item) => <TranscriptCard item={item} key={`${item.kind}-${item.id}`} />)
        ) : (
          <Card className="rounded-[8px] p-4 text-sm font-semibold leading-6 text-[var(--ve-muted)] lg:bg-[var(--ve-card-subtle)]" variant="quiet">
            {emptyText}
          </Card>
        )}
      </div>
    </section>
  );
}

export default async function LearnerTranscriptPage() {
  const supabase = await createSupabaseServerClient();
  const { user, profile } = await getCurrentUserProfile(supabase);

  if (isLiveMode && !user) {
    redirect("/login");
  }

  const [transcript, unreadNotificationCount] = await Promise.all([
    supabase && user
      ? withLoggedFallback({
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
      : Promise.resolve({
          courses: [],
          generatedAt: null,
          programmes: [],
        }),
    supabase && user
      ? withLoggedFallback({
          context: {
            operation: "profile.transcript.notifications.unread_count",
            userId: user.id,
          },
          fallback: 0,
          promise: getUnreadNotificationCount(supabase, user.id),
        })
      : Promise.resolve(0),
  ]);
  const displayName =
    profile?.display_name && !profile.display_name.includes("@")
      ? profile.display_name
      : "Learner";

  return (
    <main className="learner-system transcript-learner min-h-screen bg-[var(--ve-shell)]">
      <div className="hidden lg:block">
        <LearnerTopChrome
          active="Home"
          avatarUrl={profile?.avatar_url}
          displayName={displayName}
          email={user?.email}
          unreadNotificationCount={unreadNotificationCount}
        />
      </div>
      <header className="border-b border-[var(--ve-line-soft)] bg-[color:color-mix(in_srgb,var(--ve-green-soft)_42%,var(--ve-card))] px-5 pb-6 pt-8 lg:mx-auto lg:w-full lg:max-w-[1116px] lg:border-b-0 lg:bg-transparent lg:px-0 lg:pb-0 lg:pt-12">
        <Link
          className="mb-4 inline-flex items-center gap-2 rounded-full text-sm font-black text-[var(--ve-muted-strong)] lg:hidden"
          href="/profile"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Profile
        </Link>
        <Link
          className="mb-4 hidden w-fit items-center gap-2 text-sm font-black text-[var(--ve-muted-strong)] lg:flex"
          href="/profile"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Profile
        </Link>
        <h1 className="text-2xl font-black leading-8 text-[var(--foreground)] lg:text-[2rem] lg:leading-10">
          Learning Transcript
        </h1>
        <p className="mt-2 max-w-[18rem] text-sm font-semibold leading-6 text-[var(--ve-muted-strong)] lg:max-w-[30rem]">
          Your personal record of learning and progression.
        </p>
      </header>
      <section className="mx-auto w-full max-w-[430px] px-5 pb-28 pt-5 lg:max-w-[1116px] lg:px-0 lg:pb-16 lg:pt-8">
        <div className="grid gap-7 lg:grid-cols-2 lg:items-start">
          <TranscriptSection
            emptyText="Assigned programme records will appear here."
            icon={<BuildingIcon className="h-5 w-5 text-[#a66d00]" />}
            items={transcript.programmes}
            title="Programmes"
          />
          <TranscriptSection
            emptyText="Assigned course records will appear here."
            icon={<BookOpenIcon className="h-5 w-5 text-[var(--ve-green)]" />}
            items={transcript.courses}
            title="Courses"
          />
        </div>

        <div className="mt-6 lg:max-w-[18rem]">
          <Button className="w-full rounded-[8px]" href="/courses" variant="soft">
            Open course library
          </Button>
        </div>
      </section>
      <div className="lg:hidden">
        <BottomNav active="Transcript" />
      </div>
    </main>
  );
}
