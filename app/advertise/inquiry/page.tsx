import Link from "next/link";
import { AppHeader } from "@/components/navigation/AppHeader";
import { LearnerTopChrome } from "@/components/navigation/LearnerTopChrome";
import { CheckCircleIcon } from "@/components/ui/Icons";
import { getCurrentUserProfile } from "@/lib/supabase-server";
import { submitSponsorInquiry } from "../actions";

type SponsorInquiryPageProps = {
  searchParams?: Promise<{ submitted?: string }>;
};

const fieldClasses =
  "mt-2 w-full rounded-[14px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3.5 py-3 text-sm font-semibold outline-none focus:border-[var(--ve-green)] focus:ring-4 focus:ring-[color:color-mix(in_srgb,var(--ve-green-soft)_72%,transparent)]";
const labelClasses =
  "text-xs font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]";

export default async function SponsorInquiryPage({ searchParams }: SponsorInquiryPageProps) {
  const { submitted } = (await searchParams) ?? {};
  const { user, profile } = await getCurrentUserProfile();
  const rawDisplayName = profile?.display_name ?? "";
  const displayName = rawDisplayName && !rawDisplayName.includes("@") ? rawDisplayName : "Learner";
  const topChrome = (
    <div className="hidden lg:block">
      <LearnerTopChrome
        active="Home"
        avatarUrl={profile?.avatar_url}
        displayName={displayName}
        email={user?.email}
      />
    </div>
  );

  if (submitted === "1") {
    return (
      <main className="mobile-shell min-h-screen bg-[var(--ve-shell)]">
        {topChrome}
        <AppHeader title="Sponsor inquiry" backHref="/advertise" />
        <section className="learner-page learner-page--spacious flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center rounded-[24px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] p-8 text-center shadow-sm">
            <span className="grid size-16 place-items-center rounded-full bg-[var(--ve-green-soft)] text-[var(--ve-green)]">
              <CheckCircleIcon className="size-8" />
            </span>
            <p className="mt-4 text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-green)]">
              Inquiry received
            </p>
            <h1 className="mt-2 text-2xl font-black tracking-[-0.04em]">
              Thanks for your interest in supporting learner rewards.
            </h1>
            <p className="mt-3 max-w-[26rem] text-sm font-semibold leading-6 text-[var(--ve-muted-strong)]">
              The Project VE team will review your goals, placement interest, and timing before
              following up with sponsor options.
            </p>
            <Link
              className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--ve-green)] px-5 text-sm font-black !text-white"
              href="/advertise"
            >
              Back to sponsor overview
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="mobile-shell min-h-screen bg-[var(--ve-shell)]">
      {topChrome}
      <AppHeader title="Sponsor inquiry" backHref="/advertise" />
      <section className="learner-page learner-page--spacious space-y-5">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--ve-green)]">
            Sponsor inquiry
          </p>
          <h1 className="mt-2 text-3xl font-black leading-9 tracking-[-0.04em]">
            Tell us how your brand wants to support learner rewards.
          </h1>
          <p className="mt-3 text-sm font-semibold leading-6 text-[var(--ve-muted-strong)]">
            Use this form for direct sponsor placements, reward-backed campaigns, and values-aligned
            partnerships.
          </p>
        </div>

        <form action={submitSponsorInquiry} className="rounded-[24px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className={labelClasses}>Your name</span>
              <input className={fieldClasses} name="contactName" required />
            </label>
            <label className="block">
              <span className={labelClasses}>Organization</span>
              <input className={fieldClasses} name="organizationName" required />
            </label>
            <label className="block">
              <span className={labelClasses}>Work email</span>
              <input className={fieldClasses} name="email" required type="email" />
            </label>
            <label className="block">
              <span className={labelClasses}>Website</span>
              <input className={fieldClasses} name="websiteUrl" placeholder="https://example.com" type="url" />
            </label>
            <label className="block md:col-span-2">
              <span className={labelClasses}>Role / title</span>
              <input className={fieldClasses} name="roleTitle" />
            </label>
          </div>

          <label className="mt-4 block rounded-[16px] border-l-4 border-[var(--ve-green)] bg-[var(--ve-green-soft)] p-4">
            <span className={labelClasses}>Campaign goal</span>
            <p className="mt-1 text-xs font-semibold text-[var(--ve-muted-strong)]">
              What are you hoping to achieve with this partnership?
            </p>
            <textarea
              className={`${fieldClasses} bg-[var(--ve-card)]`}
              name="campaignGoal"
              placeholder="Example: reach young learners, fund rewards, promote a scholarship, or support career readiness."
              required
              rows={5}
            />
          </label>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className={labelClasses}>Placement interest</span>
              <input
                className={fieldClasses}
                name="placementInterest"
                placeholder="Lesson footer, dashboard, XP Store, missions, or not sure yet"
              />
            </label>
            <label className="block">
              <span className={labelClasses}>Budget range</span>
              <select className={fieldClasses} name="budgetRange" defaultValue="">
                <option value="">Not sure yet</option>
                <option value="starter">Starter sponsorship</option>
                <option value="growth">Growth campaign</option>
                <option value="major">Major rewards partner</option>
              </select>
            </label>
            <label className="block md:col-span-2">
              <span className={labelClasses}>Timing</span>
              <input className={fieldClasses} name="timing" placeholder="This month, Q4, ongoing..." />
            </label>
          </div>

          <button
            className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[var(--ve-green)] px-5 text-sm font-black text-white"
            type="submit"
          >
            Send sponsor inquiry
          </button>
          <p className="mt-3 text-center text-xs font-semibold text-[var(--ve-muted)]">
            Our partnerships team will review your inquiry and follow up with suitable options.
          </p>
        </form>
      </section>
    </main>
  );
}
