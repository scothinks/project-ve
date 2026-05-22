import { AdminPageHeader } from "@/components/admin/AdminPrimitives";
import { StaticContentEditor } from "@/components/admin/StaticContentEditor";
import { requireAdmin } from "@/lib/admin";
import { getDefaultStaticContentPages } from "@/lib/static-content";

type AdminContentPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminContentPage({
  searchParams,
}: AdminContentPageProps) {
  const [{ supabase }, resolvedParams] = await Promise.all([
    requireAdmin(),
    (searchParams ?? Promise.resolve({})) as Promise<Record<string, string | string[] | undefined>>,
  ]);

  const { faq, terms, privacy } = getDefaultStaticContentPages();
  const { data } = await supabase
    .from("static_content_pages")
    .select("slug, title, subtitle, body, faq_items, is_published, updated_at")
    .in("slug", ["faq", "terms", "privacy"]);

  const faqRow = (data ?? []).find((row) => row.slug === "faq");
  const termsRow = (data ?? []).find((row) => row.slug === "terms");
  const privacyRow = (data ?? []).find((row) => row.slug === "privacy");
  const savedSlug =
    typeof resolvedParams.saved === "string"
      ? resolvedParams.saved
      : Array.isArray(resolvedParams.saved)
        ? resolvedParams.saved[0]
        : undefined;

  return (
    <>
      <AdminPageHeader
        backHref="/admin"
        backLabel="Admin overview"
        eyebrow="Help & legal"
        title="FAQ and Terms"
        subtitle="Manage the learner-facing help and legal pages linked from the profile screen."
      />

      <StaticContentEditor
        faqPage={{
          ...faq,
          title: faqRow?.title ?? faq.title,
          subtitle: faqRow?.subtitle ?? faq.subtitle,
          body: faqRow?.body ?? faq.body,
          faqItems: Array.isArray(faqRow?.faq_items) ? (faqRow?.faq_items as typeof faq.faqItems) : faq.faqItems,
          isPublished: faqRow?.is_published ?? faq.isPublished,
          updatedAt: faqRow?.updated_at ?? faq.updatedAt,
        }}
        savedSlug={savedSlug}
        termsPage={{
          ...terms,
          title: termsRow?.title ?? terms.title,
          subtitle: termsRow?.subtitle ?? terms.subtitle,
          body: termsRow?.body ?? terms.body,
          faqItems: terms.faqItems,
          isPublished: termsRow?.is_published ?? terms.isPublished,
          updatedAt: termsRow?.updated_at ?? terms.updatedAt,
        }}
        privacyPage={{
          ...privacy,
          title: privacyRow?.title ?? privacy.title,
          subtitle: privacyRow?.subtitle ?? privacy.subtitle,
          body: privacyRow?.body ?? privacy.body,
          faqItems: privacy.faqItems,
          isPublished: privacyRow?.is_published ?? privacy.isPublished,
          updatedAt: privacyRow?.updated_at ?? privacy.updatedAt,
        }}
      />
    </>
  );
}
