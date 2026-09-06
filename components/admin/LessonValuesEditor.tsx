"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminSelect } from "@/components/admin/AdminSelect";
import { saveLessonValues } from "@/app/admin/courses/lessons/lesson-values-actions";
import { lessonValueChoicesKey, type LessonValueChoice } from "@/features/learning/admin/lesson-values-domain";
import type { ContentValueTag, ValueDimension } from "@/lib/values-assessment";
import { cn } from "@/lib/utils";

const focusOptions = [
  { label: "Main focus", detail: "Throughout the lesson", value: 0.8 },
  { label: "Supporting", detail: "Part of the lesson", value: 0.5 },
  { label: "Brief mention", detail: "A small connection", value: 0.2 },
];

export function LessonValuesEditor({ lessonId, dimensions, tags }: {
  lessonId: string; dimensions: ValueDimension[]; tags: ContentValueTag[];
}) {
  const router = useRouter();
  const [choices, setChoices] = useState<LessonValueChoice[]>(() => tags.map(({ dimensionId, weight, recommendedLevel, outcomeType }) => ({ dimensionId, weight, recommendedLevel, outcomeType })));
  const [savedChoices, setSavedChoices] = useState(choices);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const dirty = lessonValueChoicesKey(choices) !== lessonValueChoicesKey(savedChoices);
  const available = dimensions.filter((dimension) => dimension.status === "active" || tags.some((tag) => tag.dimensionId === dimension.id));
  const visible = available.filter((dimension) => `${dimension.label} ${dimension.description ?? ""}`.toLowerCase().includes(search.toLowerCase().trim()));
  const base = `/admin/courses/lessons/${lessonId}`;

  function updateChoice(dimensionId: string, updates: Partial<LessonValueChoice>) {
    setError("");
    setChoices((current) => current.map((choice) => choice.dimensionId === dimensionId ? { ...choice, ...updates } : choice));
  }

  function toggleValue(dimensionId: string) {
    setError("");
    setChoices((current) => current.some((choice) => choice.dimensionId === dimensionId)
      ? current.filter((choice) => choice.dimensionId !== dimensionId)
      : [...current, savedChoices.find((choice) => choice.dimensionId === dimensionId) ?? { dimensionId, weight: 0.8, recommendedLevel: null, outcomeType: null }]);
  }

  const continueTo = useCallback(async (href: string) => {
    if (inFlight.current) return;
    if (!dirty) { router.push(href); return; }
    inFlight.current = true;
    setSaving(true);
    setError("");
    try {
      const removedIds = savedChoices.filter((saved) => !choices.some((choice) => choice.dimensionId === saved.dimensionId)).map((choice) => choice.dimensionId);
      const result = await saveLessonValues(lessonId, choices, removedIds);
      if (result.error) { setError(result.error); return; }
      setSavedChoices(choices);
      router.push(href);
    } catch {
      setError("We couldn’t save your choices. They’re still here. Please try again.");
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }, [choices, dirty, lessonId, router, savedChoices]);

  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) {
      if (dirty) { event.preventDefault(); event.returnValue = ""; }
    }
    function followLink(event: MouseEvent) {
      if (!dirty || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(link instanceof HTMLAnchorElement) || link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href);
      if (url.origin !== window.location.origin || (url.pathname === window.location.pathname && url.search === window.location.search)) return;
      event.preventDefault();
      event.stopPropagation();
      void continueTo(`${url.pathname}${url.search}${url.hash}`);
    }
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", followLink, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", followLink, true);
    };
  }, [continueTo, dirty]);

  return <div className="space-y-8">
    <fieldset className="space-y-4" disabled={saving}>
      <legend className="mb-4 text-sm font-extrabold">Choose values <span className="ml-2 font-medium text-[var(--admin-on-surface-variant)]">{choices.length} selected</span></legend>
      {available.length > 6 ? <input aria-label="Find a value" className="w-full rounded-xl border border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] px-4 py-3 text-sm outline-none focus:border-[var(--admin-primary)]" onChange={(event) => setSearch(event.target.value)} placeholder="Find a value…" type="search" value={search} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {visible.map((dimension) => {
          const selected = choices.some((choice) => choice.dimensionId === dimension.id);
          return <label className={cn("flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors focus-within:ring-2 focus-within:ring-[var(--admin-primary)]", selected ? "border-[var(--admin-primary)] bg-[var(--admin-surface-container-low)]" : "border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] hover:border-[var(--admin-primary)]")} key={dimension.id}>
            <input aria-label={dimension.label} checked={selected} className="mt-1 h-4 w-4 shrink-0 accent-[var(--admin-primary)]" onChange={() => toggleValue(dimension.id)} type="checkbox" />
            <span><span className="block text-sm font-extrabold">{dimension.label}</span><span className="mt-1 block text-xs leading-5 text-[var(--admin-on-surface-variant)]">{dimension.description}</span></span>
          </label>;
        })}
      </div>
      {!visible.length ? <p className="py-3 text-sm text-[var(--admin-on-surface-variant)]">{available.length ? "No matching values. Try another search." : "No values are available yet. You can continue to Review."}</p> : null}
    </fieldset>

    {choices.length ? <div className="space-y-4">
      <div><h2 className="text-lg font-extrabold">Set the focus</h2><p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">How much attention does each value get?</p></div>
      {choices.map((choice) => {
        const dimension = dimensions.find((item) => item.id === choice.dimensionId);
        const label = dimension?.label ?? "Selected value";
        const options = focusOptions.some((option) => option.value === choice.weight) ? focusOptions : [{ label: "Current focus", detail: "Keep existing setting", value: choice.weight }, ...focusOptions];
        return <section aria-label={`${label} focus`} className="rounded-2xl border border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] p-5 sm:p-6" key={choice.dimensionId}>
          <div className="mb-4 flex items-center justify-between gap-3"><h3 className="font-extrabold">{label}</h3><button aria-label={`Remove ${label}`} className="rounded-lg px-2 py-1 text-xs font-bold text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-container-low)]" disabled={saving} onClick={() => toggleValue(choice.dimensionId)} type="button">Remove</button></div>
          <fieldset className="grid gap-2 sm:grid-cols-3" disabled={saving}>
            <legend className="sr-only">Focus for {label}</legend>
            {options.map((option) => <label className={cn("flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-3 focus-within:ring-2 focus-within:ring-[var(--admin-primary)]", choice.weight === option.value ? "border-[var(--admin-primary)] bg-[var(--admin-surface-container-low)]" : "border-[var(--admin-border-warm)]")} key={option.value}>
              <input checked={choice.weight === option.value} className="mt-0.5 accent-[var(--admin-primary)]" name={`focus-${choice.dimensionId}`} onChange={() => updateChoice(choice.dimensionId, { weight: option.value })} type="radio" />
              <span><span className="block text-sm font-bold">{option.label}</span><span className="mt-1 block text-xs leading-4 text-[var(--admin-on-surface-variant)]">{option.detail}</span></span>
            </label>)}
          </fieldset>
          <details className="mt-4 border-t border-[var(--admin-border-warm)] pt-4 text-sm">
            <summary className="cursor-pointer font-bold text-[var(--admin-on-surface-variant)]">Learner guidance <span className="font-normal">· Optional</span></summary>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="space-y-2"><span className="block text-xs font-bold">Learner experience</span><AdminSelect disabled={saving} onValueChange={(value) => updateChoice(choice.dimensionId, { recommendedLevel: value === "any" ? null : value as LessonValueChoice["recommendedLevel"] })} value={choice.recommendedLevel ?? "any"} options={[{ label: "Any learner", value: "any" }, { label: "New to this value", value: "beginner" }, { label: "Building understanding", value: "intermediate" }, { label: "Deepening understanding", value: "advanced" }]} /></label>
              <label className="space-y-2"><span className="block text-xs font-bold">Learning activity</span><AdminSelect disabled={saving} onValueChange={(value) => updateChoice(choice.dimensionId, { outcomeType: value === "any" ? null : value as LessonValueChoice["outcomeType"] })} value={choice.outcomeType ?? "any"} options={[{ label: "Any activity", value: "any" }, { label: "Learn about it", value: "awareness" }, { label: "Reflect on it", value: "reflection" }, { label: "Practise it", value: "practice" }, { label: "Put it into action", value: "action" }, { label: "Check understanding", value: "assessment" }]} /></label>
            </div>
          </details>
        </section>;
      })}
    </div> : <p className="text-sm text-[var(--admin-on-surface-variant)]">You can leave this blank and come back later.</p>}

    <div className="sticky bottom-0 z-20 -mx-4 border-t border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] px-4 py-4">
      {error ? <p className="mb-3 text-sm font-semibold text-[var(--admin-error)]" role="alert">{error}</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button className="rounded-full px-3 py-3 text-sm font-bold text-[var(--admin-on-surface-variant)] disabled:opacity-60" disabled={saving} onClick={() => { void continueTo(`${base}/quiz`); }} type="button">Back to quiz</button>
        <button className="rounded-full bg-[var(--admin-primary)] px-5 py-3 text-sm font-extrabold text-[var(--admin-on-primary)] disabled:opacity-60" disabled={saving} onClick={() => { void continueTo(`${base}/preview`); }} type="button">{saving ? "Saving…" : "Continue to Review"}</button>
      </div>
    </div>
  </div>;
}
