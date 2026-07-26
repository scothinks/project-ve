import Link from "next/link";
import { AppHeader } from "@/components/navigation/AppHeader";
import { Card } from "@/components/ui/Card";
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

  return (
    <main className="mobile-shell min-h-screen bg-[var(--ve-shell)]">
      <AppHeader title="Sponsor inquiry" backHref="/advertise" />
      <section className="space-y-5 px-6 py-8 pb-16">
        {submitted === "1" ? (
          <Card>
            <div className="p-5">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-green)]">
                Inquiry received
              </p>
              <h1 className="mt-2 text-2xl font-black tracking-[-0.04em]">
                Thanks for your interest in supporting learner rewards.
              </h1>
              <p className="mt-3 text-sm font-semibold leading-6 text-[var(--ve-muted-strong)]">
                The Project VE team will review your goals, placement interest, and timing before
                following up with sponsor options.
              </p>
              <Link
                className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--ve-green)] px-5 text-sm font-black text-white"
                href="/advertise"
              >
                Back to sponsor overview
              </Link>
            </div>
          </Card>
        ) : null}

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

        <form action={submitSponsorInquiry} className="space-y-4 rounded-[24px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] p-5 shadow-sm">
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
          <label className="block">
            <span className={labelClasses}>Role / title</span>
            <input className={fieldClasses} name="roleTitle" />
          </label>
          <label className="block">
            <span className={labelClasses}>Campaign goal</span>
            <textarea
              className={fieldClasses}
              name="campaignGoal"
              placeholder="Example: reach young learners, fund rewards, promote a scholarship, or support career readiness."
              required
              rows={5}
            />
          </label>
          <label className="block">
            <span className={labelClasses}>Placement interest</span>
            <input
              className={fieldClasses}
              name="placementInterest"
              placeholder="Lesson footer, dashboard, XP Store, missions, or not sure yet"
            />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className={labelClasses}>Budget range</span>
              <select className={fieldClasses} name="budgetRange" defaultValue="">
                <option value="">Not sure yet</option>
                <option value="starter">Starter sponsorship</option>
                <option value="growth">Growth campaign</option>
                <option value="major">Major rewards partner</option>
              </select>
            </label>
            <label className="block">
              <span className={labelClasses}>Timing</span>
              <input className={fieldClasses} name="timing" placeholder="This month, Q4, ongoing..." />
            </label>
          </div>
          <button
            className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[var(--ve-green)] px-5 text-sm font-black text-white"
            type="submit"
          >
            Send sponsor inquiry
          </button>
        </form>
      </section>
    </main>
  );
}
