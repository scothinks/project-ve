import { PublicInfoShell } from "@/components/navigation/PublicInfoShell";
import { getStaticContentPage } from "@/lib/static-content";

function formatUpdatedAt(isoDate: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(isoDate));
}

export default async function PrivacyPage() {
  const page = await getStaticContentPage("privacy");
  const paragraphs = page.body
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return (
    <PublicInfoShell title="Privacy">
      <article className="lg:rounded-[24px] lg:border lg:border-[var(--ve-line-soft)] lg:bg-[var(--ve-card)] lg:p-8 lg:shadow-sm">
        <header className="border-b border-[var(--ve-line-soft)] pb-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--ve-green)]">Legal</p>
          <h1 className="mt-2 text-3xl font-black leading-9 lg:text-4xl lg:leading-[1.1]">{page.title}</h1>
          {page.subtitle ? (
            <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted)]">{page.subtitle}</p>
          ) : null}
          {page.updatedAt ? (
            <p className="mt-3 text-xs font-semibold text-[var(--ve-muted)]">
              Last updated:{" "}
              <time dateTime={page.updatedAt}>{formatUpdatedAt(page.updatedAt)}</time>
            </p>
          ) : null}
        </header>

        <div className="mt-5 space-y-4">
          {paragraphs.map((paragraph, index) => (
            <p className="text-sm font-semibold leading-7 text-[var(--ve-muted-strong)]" key={`privacy-paragraph-${index}`}>
              {paragraph}
            </p>
          ))}
        </div>
      </article>
    </PublicInfoShell>
  );
}
