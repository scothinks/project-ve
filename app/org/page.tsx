import type { Metadata } from "next";
import { AppHeader } from "@/components/navigation/AppHeader";
import { BottomNav } from "@/components/navigation/BottomNav";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { createLoginHref } from "@/lib/auth-redirect";
import { getCurrentUserProfile } from "@/lib/supabase-server";

export const metadata: Metadata = {
  title: "Orgs | Project Ve",
  description: "Bring Project VE to your world with lessons, missions and rewards for your organisation.",
};

const capabilityCards = [
  {
    title: "Learning",
    body: "Deliver values education through structured courses, programmes and private learner assignments.",
    tone: "lesson" as const,
  },
  {
    title: "Missions",
    body: "Use completion goals, proof-based tasks and reviewed missions to turn learning into action.",
    tone: "mission" as const,
  },
  {
    title: "Organisation points",
    body: "Track progress with points scoped to the organisation so public Project Ve access stays separate.",
    tone: "default" as const,
  },
  {
    title: "Manual rewards",
    body: "Offer controlled rewards that can be claimed, reviewed and fulfilled by organisation operators.",
    tone: "store" as const,
  },
  {
    title: "Progress and reporting",
    body: "Follow learner movement across assignments, cohorts, mission submissions and reward claims.",
    tone: "quiet" as const,
  },
  {
    title: "Trust and privacy",
    body: "Use invitation-first access, role-based administration and private workspaces for each institution.",
    tone: "quiet" as const,
  },
];

const starterItems = [
  "Self-service organisation creation",
  "Private unverified workspace",
  "Starter learning and mission limits",
  "Manual reward fulfilment",
  "Role-based administration",
];

function OrgModePreview() {
  return (
    <div
      aria-label="Orgs workspace preview"
      className="relative overflow-hidden rounded-[28px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] p-4 shadow-[0_24px_70px_rgba(var(--ve-shadow-rgb),0.14)]"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-green)]">
            Orgs
          </p>
          <h2 className="mt-1 text-lg font-black tracking-[-0.02em] text-[var(--foreground)]">
            Starter workspace
          </h2>
        </div>
        <div className="rounded-full bg-[var(--ve-green-soft)] px-3 py-1 text-[11px] font-black text-[var(--ve-green)]">
          Private
        </div>
      </div>

      <div className="mt-5 grid gap-3">
        <div className="rounded-[18px] border border-[var(--ve-line-soft)] bg-[var(--ve-card-muted)] p-4">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-black text-[var(--foreground)]">Learning</span>
            <span className="text-xs font-bold text-[var(--ve-muted)]">6 active</span>
          </div>
          <div className="mt-3 h-2 rounded-full bg-[var(--ve-line-soft)]">
            <div className="h-full w-2/3 rounded-full bg-[var(--ve-green)]" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-[18px] bg-[#fff4ef] p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#c94f2e]">
              Missions
            </p>
            <p className="mt-2 text-2xl font-black text-[var(--foreground)]">12</p>
          </div>
          <div className="rounded-[18px] bg-[#fff8df] p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#a66d00]">
              Points
            </p>
            <p className="mt-2 text-2xl font-black text-[var(--foreground)]">8.4k</p>
          </div>
        </div>

        <div className="rounded-[18px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] p-4">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-black text-[var(--foreground)]">Reporting</span>
            <span className="text-xs font-bold text-[var(--ve-green)]">Ready</span>
          </div>
          <p className="mt-2 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
            Cohort progress, mission review queues and reward claims stay in the organisation workspace.
          </p>
        </div>
      </div>
    </div>
  );
}

export default async function OrgModePage() {
  const { user } = await getCurrentUserProfile();
  const createHref = user ? "/org/create" : createLoginHref("/org/create");
  const enterHref = user ? "/org/my" : createLoginHref("/org/my");

  return (
    <main className="mobile-shell min-h-screen bg-[var(--ve-shell)]">
      <AppHeader title="Orgs" backHref={user ? "/dashboard" : "/"} showMenu={false} />

      <section className="px-5 py-6 lg:px-[clamp(2rem,4vw,4.5rem)]">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--ve-green)]">
                About Project Ve for Organisations
              </p>
              <h1 className="mt-3 max-w-3xl text-[clamp(2.25rem,6vw,4.5rem)] font-black leading-[0.98] tracking-[-0.05em] text-[var(--foreground)]">
                Orgs
              </h1>
              <p className="mt-5 max-w-2xl text-base font-semibold leading-7 text-[var(--ve-muted-strong)] sm:text-lg sm:leading-8">
                Bring Project VE to your world. Design your own lessons, missions, and rewards for
                your organisation, community, or family.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Button className="h-12 px-6 text-sm font-black" href={createHref}>
                  Create Org
                </Button>
                <Button className="h-12 px-6 text-sm font-black" href={enterHref} variant="outline">
                  Enter Org
                </Button>
              </div>
            </div>

            <OrgModePreview />
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {capabilityCards.map((item) => (
              <Card className="p-5" key={item.title} variant={item.tone}>
                <h2 className="text-lg font-black tracking-[-0.02em] text-[var(--foreground)]">
                  {item.title}
                </h2>
                <p className="mt-3 text-sm font-semibold leading-6 text-[var(--ve-muted-strong)]">
                  {item.body}
                </p>
              </Card>
            ))}
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Card className="p-5 sm:p-6" variant="lesson">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-green)]">
                Starter summary
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[var(--foreground)]">
                Start privately, then validate the institution.
              </h2>
              <ul className="mt-5 space-y-3">
                {starterItems.map((item) => (
                  <li
                    className="flex items-start gap-3 text-sm font-bold leading-6 text-[var(--ve-muted-strong)]"
                    key={item}
                  >
                    <span
                      aria-hidden="true"
                      className="mt-1 grid size-5 shrink-0 place-items-center rounded-full bg-[var(--ve-green)] text-[10px] font-black text-white"
                    >
                      ✓
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="p-5 sm:p-6" variant="quiet">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">
                Paid plans
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[var(--foreground)]">
                Unlock higher limits and deeper institution operations.
              </h2>
              <p className="mt-4 text-sm font-semibold leading-6 text-[var(--ve-muted-strong)]">
                Paid plans are positioned for larger programmes, richer reporting, more active
                missions, broader media use, larger reward queues and institution-specific support
                as Phase 1.5 capabilities expand.
              </p>
              <div className="mt-5 rounded-[18px] border border-[var(--ve-line-soft)] bg-[var(--ve-card-muted)] p-4">
                <p className="text-sm font-black text-[var(--foreground)]">Access stays invite-first.</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted-strong)]">
                  Learners do not enter organisation codes, browse a public directory or search for
                  private institutions from this page.
                </p>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {user ? <BottomNav active="Orgs" /> : null}
    </main>
  );
}
