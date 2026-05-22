import { AppHeader } from "@/components/navigation/AppHeader";
import { BottomNav } from "@/components/navigation/BottomNav";
import { getStaticContentPage } from "@/lib/static-content";

export default async function FaqPage() {
  const page = await getStaticContentPage("faq");

  return (
    <main className="mobile-shell min-h-screen bg-[var(--ve-card)]">
      <AppHeader title="FAQ" backHref="/profile" />
      <section className="space-y-5 px-6 py-8 pb-28">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#008751]">Help</p>
          <h1 className="mt-2 text-3xl font-black leading-9">{page.title}</h1>
          {page.subtitle ? (
            <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted)]">{page.subtitle}</p>
          ) : null}
        </div>

        <div className="space-y-3">
          {page.faqItems.map((item, index) => (
            <details className="rounded-[20px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] px-5 py-4 shadow-sm" key={`${item.question}-${index}`}>
              <summary className="cursor-pointer list-none pr-6 text-base font-black text-[var(--foreground)]">
                {item.question}
              </summary>
              <p className="mt-3 text-sm font-semibold leading-7 text-[#5f5f5a]">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>
      <BottomNav active="Home" />
    </main>
  );
}
