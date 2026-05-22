"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { AdminCard, AdminNoticeBanner } from "@/components/admin/AdminPrimitives";
import type { FaqItem, StaticContentPage } from "@/lib/static-content";
import { saveStaticContentPage } from "@/app/admin/content/actions";

function fieldClasses() {
  return "mt-2 w-full rounded-[14px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-4 py-3 text-sm font-bold outline-none transition focus:border-[#087f5b] focus:ring-4 focus:ring-[#087f5b]/10";
}

function labelClasses() {
  return "text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]";
}

export function StaticContentEditor({
  faqPage,
  termsPage,
  privacyPage,
  savedSlug,
}: {
  faqPage: StaticContentPage;
  termsPage: StaticContentPage;
  privacyPage: StaticContentPage;
  savedSlug?: string;
}) {
  const [faqItems, setFaqItems] = useState<FaqItem[]>(faqPage.faqItems);

  const faqItemsJson = useMemo(() => JSON.stringify(faqItems), [faqItems]);

  function updateFaqItem(index: number, patch: Partial<FaqItem>) {
    setFaqItems((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    );
  }

  function addFaqItem() {
    setFaqItems((current) => [...current, { question: "", answer: "" }]);
  }

  function removeFaqItem(index: number) {
    setFaqItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  return (
    <section className="space-y-6">
      {savedSlug === "faq" ? <AdminNoticeBanner>FAQ saved.</AdminNoticeBanner> : null}
      {savedSlug === "terms" ? <AdminNoticeBanner>Terms saved.</AdminNoticeBanner> : null}
      {savedSlug === "privacy" ? <AdminNoticeBanner>Privacy saved.</AdminNoticeBanner> : null}

      <AdminCard>
        <details>
          <summary className="cursor-pointer list-none">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#087f5b]">FAQ</p>
            <h2 className="mt-2 text-2xl font-black">Frequently asked questions</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted-strong)]">
              Keep this fast to scan. Each answer should be direct and easy to understand on mobile.
            </p>
          </summary>

          <form action={saveStaticContentPage} className="mt-5 space-y-5">
            <input name="slug" type="hidden" value="faq" />
            <input name="isPublished" type="hidden" value="true" />
            <input name="faqItemsJson" type="hidden" value={faqItemsJson} />

            <div className="grid gap-4 md:grid-cols-2">
              <label>
                <span className={labelClasses()}>Page title</span>
                <input className={fieldClasses()} defaultValue={faqPage.title} name="title" required />
              </label>
              <label>
                <span className={labelClasses()}>Subtitle</span>
                <input className={fieldClasses()} defaultValue={faqPage.subtitle} name="subtitle" />
              </label>
            </div>

            <div className="space-y-4">
              {faqItems.map((item, index) => (
                <div className="rounded-[18px] border border-[var(--ve-line-soft)] bg-[var(--ve-shell)] p-4" key={`faq-item-${index}`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-black">Question {index + 1}</p>
                    <button
                      className="rounded-[12px] bg-[#fff0f0] px-3 py-2 text-xs font-black text-[#c00000]"
                      onClick={() => removeFaqItem(index)}
                      type="button"
                    >
                      Remove
                    </button>
                  </div>
                  <label className="mt-4 block">
                    <span className={labelClasses()}>Question</span>
                    <input
                      className={fieldClasses()}
                      onChange={(event) => updateFaqItem(index, { question: event.target.value })}
                      value={item.question}
                    />
                  </label>
                  <label className="mt-4 block">
                    <span className={labelClasses()}>Answer</span>
                    <textarea
                      className={`${fieldClasses()} min-h-[120px] resize-y`}
                      onChange={(event) => updateFaqItem(index, { answer: event.target.value })}
                      value={item.answer}
                    />
                  </label>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button onClick={addFaqItem} type="button" variant="outline">
                Add question
              </Button>
              <Button type="submit">Save FAQ</Button>
            </div>
          </form>
        </details>
      </AdminCard>

      <AdminCard>
        <details>
          <summary className="cursor-pointer list-none">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#087f5b]">Terms</p>
            <h2 className="mt-2 text-2xl font-black">Terms page</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted-strong)]">
              Use short paragraphs. Keep legal language clear enough for ordinary users to follow.
            </p>
          </summary>

          <form action={saveStaticContentPage} className="mt-5 space-y-5">
            <input name="slug" type="hidden" value="terms" />
            <input name="isPublished" type="hidden" value="true" />

            <div className="grid gap-4 md:grid-cols-2">
              <label>
                <span className={labelClasses()}>Page title</span>
                <input className={fieldClasses()} defaultValue={termsPage.title} name="title" required />
              </label>
              <label>
                <span className={labelClasses()}>Subtitle</span>
                <input className={fieldClasses()} defaultValue={termsPage.subtitle} name="subtitle" />
              </label>
            </div>

            <label className="block">
              <span className={labelClasses()}>Body</span>
              <textarea
                className={`${fieldClasses()} min-h-[320px] resize-y`}
                defaultValue={termsPage.body}
                name="body"
                required
              />
            </label>

            <Button type="submit">Save Terms</Button>
          </form>
        </details>
      </AdminCard>

      <AdminCard>
        <details>
          <summary className="cursor-pointer list-none">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#087f5b]">Privacy</p>
            <h2 className="mt-2 text-2xl font-black">Privacy page</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted-strong)]">
              Keep this clear and practical. Tell learners what data is used, why it is used, and
              when it may be shared for reward fulfillment.
            </p>
          </summary>

          <form action={saveStaticContentPage} className="mt-5 space-y-5">
            <input name="slug" type="hidden" value="privacy" />
            <input name="isPublished" type="hidden" value="true" />

            <div className="grid gap-4 md:grid-cols-2">
              <label>
                <span className={labelClasses()}>Page title</span>
                <input className={fieldClasses()} defaultValue={privacyPage.title} name="title" required />
              </label>
              <label>
                <span className={labelClasses()}>Subtitle</span>
                <input className={fieldClasses()} defaultValue={privacyPage.subtitle} name="subtitle" />
              </label>
            </div>

            <label className="block">
              <span className={labelClasses()}>Body</span>
              <textarea
                className={`${fieldClasses()} min-h-[320px] resize-y`}
                defaultValue={privacyPage.body}
                name="body"
                required
              />
            </label>

            <Button type="submit">Save Privacy</Button>
          </form>
        </details>
      </AdminCard>
    </section>
  );
}
