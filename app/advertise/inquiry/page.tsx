import Image from "next/image";
import Link from "next/link";
import { AppHeader } from "@/components/navigation/AppHeader";
import { BudgetRadioGroup } from "@/components/advertise/BudgetRadioGroup";
import { LearnerTopChrome } from "@/components/navigation/LearnerTopChrome";
import { ArrowRightIcon, CheckCircleIcon, SendIcon } from "@/components/ui/Icons";
import { getCurrentUserProfile } from "@/lib/supabase-server";
import { submitSponsorInquiry } from "../actions";

type SponsorInquiryPageProps = {
  searchParams?: Promise<{ submitted?: string }>;
};

const fieldClasses =
  "mt-2 w-full rounded-[14px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3.5 py-3 text-sm font-semibold outline-none focus:border-[var(--ve-green)] focus:ring-4 focus:ring-[color:color-mix(in_srgb,var(--ve-green-soft)_72%,transparent)]";
const labelClasses = "text-xs font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]";

const whyPartner = [
  "Align your brand with practical, values-based education.",
  "Reach a highly engaged, motivated demographic of learners.",
  "Help fund tangible rewards that keep learners motivated.",
];

const budgetOptions = [
  { value: "starter", label: "Starter sponsorship" },
  { value: "growth", label: "Growth campaign" },
  { value: "major", label: "Major rewards partner" },
  { value: "", label: "Not sure yet" },
];

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
        <AppHeader backHref="/advertise" hideTitle title="Sponsor inquiry" />
        <section className="learner-page learner-page--spacious flex flex-1 items-center justify-center">
          <div className="relative flex w-full max-w-lg flex-col items-center overflow-hidden rounded-[24px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] p-8 text-center shadow-sm lg:p-12">
            <span className="absolute inset-x-0 top-0 h-1 bg-[var(--ve-green)]" aria-hidden="true" />
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
      <AppHeader backHref="/advertise" hideTitle title="Sponsor inquiry" />
      <section className="learner-page learner-page--spacious">
        <div className="lg:hidden">
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

        <div className="lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start lg:gap-12">
          <aside className="hidden lg:sticky lg:top-24 lg:flex lg:flex-col lg:gap-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--ve-green)]">
                Sponsorships
              </p>
              <h1 className="mt-2 text-3xl font-black leading-9 tracking-[-0.04em]">
                Partner with Project VE.
              </h1>
              <p className="mt-3 text-sm font-semibold leading-6 text-[var(--ve-muted-strong)]">
                Help us fund meaningful rewards for dedicated learners. Your sponsorship directly
                supports a rewards ecosystem built on transparency and shared value.
              </p>
            </div>
            <div className="relative aspect-video w-full overflow-hidden rounded-[20px] border border-[var(--ve-line-soft)]">
              <Image
                alt="A calm, modern learning space with natural light and warm wood surfaces."
                className="object-cover"
                fill
                sizes="40vw"
                src="/images/advertise-hero.jpg"
              />
            </div>
            <div className="rounded-[20px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] p-5">
              <h3 className="text-sm font-black">Why partner?</h3>
              <ul className="mt-3 space-y-3">
                {whyPartner.map((item) => (
                  <li className="flex items-start gap-2.5" key={item}>
                    <ArrowRightIcon className="mt-0.5 size-4 shrink-0 text-[var(--ve-green)]" />
                    <p className="text-sm font-semibold leading-6 text-[var(--ve-muted-strong)]">
                      {item}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          <div className="mt-5 rounded-[24px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] p-5 shadow-sm lg:mt-0 lg:p-8">
            <h2 className="hidden border-b border-[var(--ve-line-soft)] pb-4 text-xl font-black tracking-[-0.03em] lg:block lg:mb-6">
              Sponsor inquiry
            </h2>
            <form action={submitSponsorInquiry} className="flex flex-col gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className={labelClasses}>Your name</span>
                  <input className={fieldClasses} name="contactName" required />
                </label>
                <label className="block">
                  <span className={labelClasses}>Role / title</span>
                  <input className={fieldClasses} name="roleTitle" />
                </label>
                <label className="block">
                  <span className={labelClasses}>Organization</span>
                  <input className={fieldClasses} name="organizationName" required />
                </label>
                <label className="block">
                  <span className={labelClasses}>Website</span>
                  <input className={fieldClasses} name="websiteUrl" placeholder="https://example.com" type="url" />
                </label>
                <label className="block md:col-span-2">
                  <span className={labelClasses}>Work email</span>
                  <input className={fieldClasses} name="email" required type="email" />
                </label>
              </div>

              <hr className="my-1 border-[var(--ve-line-soft)]" />

              <label className="block rounded-[16px] border-l-4 border-[var(--ve-green)] bg-[var(--ve-green-soft)] p-4">
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

              <label className="block">
                <span className={labelClasses}>Placement interest</span>
                <select className={fieldClasses} name="placementInterest" defaultValue="">
                  <option value="">Open to recommendations</option>
                  <option value="lessons">In-lesson sponsorships</option>
                  <option value="missions">Mission rewards</option>
                  <option value="newsletter">Weekly newsletter</option>
                </select>
              </label>

              <fieldset>
                <legend className={labelClasses}>Budget range</legend>
                <div className="mt-2">
                  <BudgetRadioGroup name="budgetRange" options={budgetOptions} />
                </div>
              </fieldset>

              <label className="block">
                <span className={labelClasses}>Timing</span>
                <input className={fieldClasses} name="timing" placeholder="This month, Q4, ongoing..." />
              </label>

              <button
                className="mt-2 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--ve-green)] px-5 text-sm font-black text-white"
                type="submit"
              >
                Send sponsor inquiry
                <SendIcon className="size-4" />
              </button>
              <p className="text-center text-xs font-semibold text-[var(--ve-muted)]">
                Our partnerships team will review your inquiry and follow up with suitable options.
              </p>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
