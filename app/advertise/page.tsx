import Link from "next/link";
import { AppHeader } from "@/components/navigation/AppHeader";
import { Card } from "@/components/ui/Card";

const placementHighlights = [
  "Sponsor placements that help fund high-value learner rewards",
  "Native lesson, dashboard, course, missions, and XP Store moments",
  "First-party targeting, clear disclosure, viewability, IVT filtering, and pacing",
];

const sponsorOptions = [
  {
    title: "Reward Supporter",
    body: "Back the reward pool and appear in warm native placements that explain your support.",
  },
  {
    title: "Learning Moment Sponsor",
    body: "Reach learners around lessons, missions, and course discovery without interrupting progress.",
  },
  {
    title: "Community Partner",
    body: "Build a longer-running presence around learner outcomes, career readiness, or access programs.",
  },
];

const nextSteps = [
  "Tell us your campaign goal and the audience you want to support.",
  "We recommend placements, copy guardrails, and a reporting structure.",
  "Approved campaigns launch through Project VE’s first-party direct ads system.",
];

export default function AdvertisePage() {
  return (
    <main className="mobile-shell min-h-screen bg-[var(--ve-shell)]">
      <AppHeader title="Advertise" backHref="/" />
      <section className="space-y-5 px-6 py-8 pb-16">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--ve-green)]">
            Project VE Partnerships
          </p>
          <h1 className="mt-2 text-3xl font-black leading-9 tracking-[-0.04em]">
            Help keep high-value rewards available to every learner.
          </h1>
          <p className="mt-3 text-sm font-semibold leading-6 text-[var(--ve-muted-strong)]">
            Sponsor Project VE placements to support a rewards ecosystem learners can
            actually feel. Your brand reaches motivated learners while helping fund
            meaningful incentives across the community.
          </p>
        </div>

        <Card>
          <div className="p-5">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-green)]">
              Built for values-aligned sponsors
            </p>
            <div className="mt-4 space-y-3">
              {placementHighlights.map((item) => (
                <div className="flex gap-3" key={item}>
                  <span className="mt-1 size-2.5 rounded-full bg-[var(--ve-green)]" />
                  <p className="text-sm font-bold leading-6 text-[var(--ve-muted-strong)]">
                    {item}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-5">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">
              Sponsor options
            </p>
            <h2 className="mt-2 text-xl font-black tracking-[-0.03em]">
              Choose the kind of support you want to be known for.
            </h2>
            <div className="mt-4 grid gap-3">
              {sponsorOptions.map((option) => (
                <div className="rounded-[18px] bg-[var(--ve-panel)] p-4" key={option.title}>
                  <h3 className="text-sm font-black">{option.title}</h3>
                  <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted-strong)]">
                    {option.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-5">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">
              What sponsors can expect
            </p>
            <h2 className="mt-2 text-xl font-black tracking-[-0.03em]">
              Visible support, not interruptive advertising.
            </h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-[var(--ve-muted-strong)]">
              Campaigns are reviewed internally, clearly disclosed, and served through Project
              VE’s first-party ad system. We do not use external ad providers, third-party ad
              scripts, or cross-site tracking. The goal is simple: help sponsors show up in
              trusted learning moments while keeping rewards accessible.
            </p>
          </div>
        </Card>

        <Card>
          <div className="p-5">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">
              Good sponsor fit
            </p>
            <h2 className="mt-2 text-xl font-black tracking-[-0.03em]">
              Brands that want to back progress.
            </h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-[var(--ve-muted-strong)]">
              Project VE is a fit for education, career, wellness, financial access,
              community, and youth-focused partners who want their media spend to support
              learner outcomes instead of disappearing into generic ad inventory.
            </p>
          </div>
        </Card>

        <Card>
          <div className="p-5">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">
              What happens next
            </p>
            <div className="mt-4 space-y-3">
              {nextSteps.map((step, index) => (
                <div className="flex gap-3" key={step}>
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[color:color-mix(in_srgb,var(--ve-green-soft)_74%,var(--ve-card))] text-xs font-black text-[var(--ve-green)]">
                    {index + 1}
                  </span>
                  <p className="text-sm font-bold leading-6 text-[var(--ve-muted-strong)]">
                    {step}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <div className="rounded-[24px] bg-[var(--ve-green)] p-5 text-white shadow-[0_18px_42px_rgba(0,135,81,0.22)]">
          <p className="text-xs font-black uppercase tracking-[0.14em] opacity-80">
            Sponsor inquiry
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.04em]">
            Request sponsor options.
          </h2>
          <p className="mt-2 text-sm font-semibold leading-6 opacity-90">
            Tell us your campaign goal, target audience, preferred timing, and how you want
            your brand to support learner rewards.
          </p>
          <Link
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-black text-[var(--ve-green)]"
            href="/advertise/inquiry"
          >
            Contact partnerships
          </Link>
        </div>
      </section>
    </main>
  );
}
