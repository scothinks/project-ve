import { PublicInfoShell } from "@/components/navigation/PublicInfoShell";
import { getStaticContentPage } from "@/lib/static-content";

export default async function FaqPage() {
  const page = await getStaticContentPage("faq");

  return (
    <PublicInfoShell title="FAQ">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--ve-green)]">Help</p>
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
            <p className="mt-3 text-sm font-semibold leading-7 text-[var(--ve-muted-strong)]">{item.answer}</p>
          </details>
        ))}
      </div>
    </PublicInfoShell>
  );
}
