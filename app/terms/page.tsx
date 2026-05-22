import { AppHeader } from "@/components/navigation/AppHeader";
import { BottomNav } from "@/components/navigation/BottomNav";
import { getStaticContentPage } from "@/lib/static-content";

export default async function TermsPage() {
  const page = await getStaticContentPage("terms");
  const paragraphs = page.body
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return (
    <main className="mobile-shell min-h-screen bg-[var(--ve-card)]">
      <AppHeader title="Terms" backHref="/profile" />
      <section className="space-y-5 px-6 py-8 pb-28">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#008751]">Legal</p>
          <h1 className="mt-2 text-3xl font-black leading-9">{page.title}</h1>
          {page.subtitle ? (
            <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted)]">{page.subtitle}</p>
          ) : null}
        </div>

        <article className="space-y-4 rounded-[20px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] px-5 py-5 shadow-sm">
          {paragraphs.map((paragraph, index) => (
            <p className="text-sm font-semibold leading-7 text-[#5f5f5a]" key={`terms-paragraph-${index}`}>
              {paragraph}
            </p>
          ))}
        </article>
      </section>
      <BottomNav active="Home" />
    </main>
  );
}
