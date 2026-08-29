import type { Metadata } from "next";
import { PublicInfoShell } from "@/components/navigation/PublicInfoShell";
import { Button } from "@/components/ui/Button";
import { ArrowRightIcon, ChatIcon, HelpCircleIcon, UsersIcon } from "@/components/ui/Icons";

export const metadata: Metadata = {
  title: "Contact | Project Ve",
  description: "Find the right Project VE workflow for support, FAQs, or sponsor partnerships.",
};

const pathways = [
  {
    title: "Get help",
    body: "For account, learning, missions, rewards and technical issues.",
    icon: ChatIcon,
    ctaLabel: "Get support",
    href: "/support",
    variant: "primary" as const,
  },
  {
    title: "Browse FAQs",
    body: "For common questions about learning, XP, rewards and missions.",
    icon: HelpCircleIcon,
    ctaLabel: "Browse FAQs",
    href: "/faq",
    variant: "outline" as const,
  },
  {
    title: "Partnerships",
    body: "For sponsorship, brand partnerships, or reward support.",
    icon: UsersIcon,
    ctaLabel: "Explore partnerships",
    href: "/advertise",
    variant: "outline" as const,
  },
];

export default function ContactPage() {
  return (
    <PublicInfoShell title="Contact" wide>
      <div>
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--ve-green)]">Contact</p>
        <h1 className="mt-2 text-3xl font-black leading-9">Contact Project VE</h1>
        <p className="mt-3 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
          How can we help you?
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {pathways.map((pathway) => (
          <div
            className="flex flex-col rounded-[24px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] p-5 shadow-sm"
            key={pathway.title}
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[var(--ve-green-soft)] text-[var(--ve-green)]">
              <pathway.icon className="size-5" />
            </span>
            <h2 className="mt-4 text-lg font-black">{pathway.title}</h2>
            <p className="mt-2 flex-1 text-sm font-semibold leading-6 text-[var(--ve-muted-strong)]">
              {pathway.body}
            </p>
            <Button className="mt-5 gap-2" href={pathway.href} variant={pathway.variant}>
              {pathway.ctaLabel}
              <ArrowRightIcon className="size-4" />
            </Button>
          </div>
        ))}
      </div>
    </PublicInfoShell>
  );
}
