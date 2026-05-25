import { AppHeader } from "@/components/navigation/AppHeader";
import { BottomNav } from "@/components/navigation/BottomNav";
import { SupportEmbed } from "@/components/support/SupportEmbed";

export default function SupportPage() {
  return (
    <main className="mobile-shell min-h-screen bg-[var(--ve-shell)]">
      <AppHeader title="Support" backHref="/profile" />
      <section className="space-y-5 px-6 py-8 pb-28">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--ve-green)]">Support</p>
          <h1 className="mt-2 text-3xl font-black leading-9">Get help</h1>
          <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
            Share your issue or question and our team will review it.
          </p>
        </div>

        <SupportEmbed />
      </section>
      <BottomNav active="Home" />
    </main>
  );
}
