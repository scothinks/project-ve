import Image from "next/image";
import Link from "next/link";
import { AppHeader } from "@/components/navigation/AppHeader";
import { LearnerTopChrome } from "@/components/navigation/LearnerTopChrome";
import { Button } from "@/components/ui/Button";
import {
  ArrowRightIcon,
  BookOpenIcon,
  CheckCircleIcon,
  GiftIcon,
  ShieldIcon,
  UsersIcon,
} from "@/components/ui/Icons";
import { getCurrentUserProfile } from "@/lib/supabase-server";

const sponsorOptions = [
  {
    title: "Reward Supporter",
    body: "Back the reward pool and appear in warm native placements that explain your support.",
    icon: GiftIcon,
    accent: "#087f5b",
  },
  {
    title: "Learning Moment Sponsor",
    body: "Reach learners around lessons, missions, and course discovery without interrupting progress.",
    icon: BookOpenIcon,
    accent: "#146c9c",
  },
  {
    title: "Community Partner",
    body: "Build a longer-running presence around learner outcomes, career readiness, or access programs.",
    icon: UsersIcon,
    accent: "#8d68f2",
  },
];

const trustPoints = [
  {
    title: "Zero third-party scripts",
    body: "Campaigns run natively within Project VE.",
  },
  {
    title: "No cross-site tracking",
    body: "We prioritize absolute privacy for our learners.",
  },
  {
    title: "Contextual relevance",
    body: "Placements are designed to feel like native rewards and encouragements.",
  },
];

const steps = [
  {
    title: "Share your goal",
    body: "Tell us your campaign goal and the audience you want to support.",
  },
  {
    title: "Recommendation",
    body: "We recommend placements, copy guardrails, and a reporting structure.",
  },
  {
    title: "Launch",
    body: "Approved campaigns launch through Project VE's first-party direct ads system.",
  },
];

export default async function AdvertisePage() {
  const { user, profile } = await getCurrentUserProfile();
  const rawDisplayName = profile?.display_name ?? "";
  const displayName = rawDisplayName && !rawDisplayName.includes("@") ? rawDisplayName : "Learner";

  return (
    <main className="mobile-shell min-h-screen bg-[var(--ve-shell)]">
      <div className="hidden lg:block">
        <LearnerTopChrome
          active="Home"
          avatarUrl={profile?.avatar_url}
          displayName={displayName}
          email={user?.email}
        />
      </div>
      <AppHeader backHref="/" hideTitle title="Advertise" />
      <section className="learner-page learner-page--spacious space-y-9 lg:space-y-14">
        {/* Hero */}
        <div className="lg:grid lg:grid-cols-2 lg:items-center lg:gap-12">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--ve-green)]">
              Project VE Partnerships
            </p>
            <h1 className="mt-2 text-3xl font-black leading-9 tracking-[-0.04em] lg:text-[2.6rem] lg:leading-[1.05]">
              Help keep high-value rewards available to every learner.
            </h1>
            <p className="mt-3 text-sm font-semibold leading-6 text-[var(--ve-muted-strong)] lg:mt-5 lg:text-base lg:leading-7">
              Sponsor Project VE placements to support a rewards ecosystem learners can
              actually feel. Your brand reaches motivated learners while helping fund
              meaningful incentives across the community.
            </p>
            <div className="hidden lg:block">
              <Button className="mt-6 gap-2" href="/advertise/inquiry">
                Contact partnerships
                <ArrowRightIcon className="size-4" />
              </Button>
            </div>
          </div>
          <div className="relative mt-5 aspect-[4/3] w-full overflow-hidden rounded-[24px] border border-[var(--ve-line-soft)] lg:mt-0">
            <Image
              alt="A calm, modern learning space with natural light and warm wood surfaces."
              className="object-cover"
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
              src="/images/advertise-hero.jpg"
            />
          </div>
        </div>

        {/* Partnership pathways */}
        <div>
          <div className="lg:text-center">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">
              Partnership Pathways
            </p>
            <h2 className="mt-2 text-xl font-black tracking-[-0.03em] lg:text-2xl">
              Choose the kind of support you want to be known for.
            </h2>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {sponsorOptions.map((option) => (
              <div
                className="rounded-[20px] border-l-4 bg-[var(--ve-card)] p-5 shadow-sm"
                key={option.title}
                style={{ borderLeftColor: option.accent }}
              >
                <span
                  className="grid size-11 shrink-0 place-items-center rounded-full"
                  style={{ backgroundColor: `color-mix(in srgb, ${option.accent} 16%, transparent)`, color: option.accent }}
                >
                  <option.icon className="size-5" />
                </span>
                <h3 className="mt-4 text-sm font-black">{option.title}</h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted-strong)]">
                  {option.body}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Trust model */}
        <div
          className="relative overflow-hidden rounded-[28px] p-6 text-white lg:p-12"
          style={{ background: "linear-gradient(135deg, #0b3d2e 0%, #052018 100%)" }}
        >
          <div
            className="pointer-events-none absolute right-0 top-0 h-56 w-56 -translate-y-1/3 translate-x-1/4 rounded-full opacity-20 blur-3xl"
            style={{ backgroundColor: "#087f5b" }}
          />
          <div className="relative max-w-2xl">
            <span className="grid size-11 place-items-center rounded-full bg-white/10 text-white">
              <ShieldIcon className="size-5" />
            </span>
            <h2 className="mt-4 text-2xl font-black tracking-[-0.03em] lg:text-3xl">
              Visible support, not interruptive advertising.
            </h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-white/75 lg:text-base lg:leading-7">
              We respect learners&apos; focus. Our partnership model is built entirely on a
              first-party system designed to enhance the educational experience, not detract
              from it.
            </p>
            <ul className="mt-5 space-y-3">
              {trustPoints.map((point) => (
                <li className="flex items-start gap-3" key={point.title}>
                  <CheckCircleIcon className="mt-0.5 size-5 shrink-0 text-[#78d9af]" />
                  <p className="text-sm font-semibold leading-6 text-white/90">
                    <span className="font-black text-white">{point.title}:</span> {point.body}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* How it works */}
        <div>
          <div className="lg:text-center">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">
              How it works
            </p>
            <h2 className="mt-2 text-xl font-black tracking-[-0.03em] lg:text-2xl">
              A simple, transparent process to start supporting learners.
            </h2>
          </div>
          <div className="relative mt-6 space-y-6 lg:grid lg:grid-cols-3 lg:gap-6 lg:space-y-0">
            <div
              className="pointer-events-none absolute left-[16%] right-[16%] top-6 hidden h-px bg-[var(--ve-line-soft)] lg:block"
              aria-hidden="true"
            />
            {steps.map((step, index) => (
              <div className="relative flex gap-4 lg:flex-col lg:items-center lg:text-center" key={step.title}>
                <span className="grid size-12 shrink-0 place-items-center rounded-full border-2 border-[var(--ve-card)] bg-[var(--ve-card-muted)] text-sm font-black text-[var(--ve-green)] shadow-sm">
                  {index + 1}
                </span>
                <div className="lg:mt-3">
                  <h3 className="text-sm font-black">{step.title}</h3>
                  <p className="mt-1 text-sm font-semibold leading-6 text-[var(--ve-muted-strong)]">
                    {step.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <footer className="flex flex-col items-center gap-3 border-t border-[var(--ve-line-soft)] pt-6 text-center lg:flex-row lg:justify-between lg:text-left">
          <p className="text-sm font-black">Project VE</p>
          <div className="flex items-center gap-4 text-xs font-bold text-[var(--ve-muted)]">
            <Link className="hover:text-[var(--foreground)]" href="/privacy">
              Privacy Policy
            </Link>
            <span aria-hidden="true">•</span>
            <Link className="hover:text-[var(--foreground)]" href="/terms">
              Terms of Service
            </Link>
            <span aria-hidden="true">•</span>
            <Link className="hover:text-[var(--foreground)]" href="/support">
              Support
            </Link>
          </div>
        </footer>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--ve-line-soft)] bg-[var(--ve-card)]/95 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-md lg:hidden">
        <Button className="w-full gap-2" href="/advertise/inquiry">
          Contact partnerships
          <ArrowRightIcon className="size-4" />
        </Button>
      </div>
    </main>
  );
}
