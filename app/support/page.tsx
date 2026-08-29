import { PublicInfoShell } from "@/components/navigation/PublicInfoShell";
import { SupportEmbed } from "@/components/support/SupportEmbed";

export default function SupportPage() {
  return (
    <PublicInfoShell title="Support">
      <div className="lg:text-center">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#765a05]">Support</p>
        <h1 className="mt-2 text-3xl font-black leading-9 lg:text-4xl">Get help.</h1>
        <p className="mt-2 max-w-[90%] text-sm font-semibold leading-6 text-[var(--ve-muted)] lg:mx-auto lg:max-w-lg">
          Share your issue or question and our team will review it carefully to provide the best
          assistance.
        </p>
      </div>

      <SupportEmbed />
    </PublicInfoShell>
  );
}
