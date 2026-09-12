export function CourseAudienceField({ defaultValue }: { defaultValue: string }) {
  return (
    <label className="block">
      <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ui-text-muted)]">
        Who this course is written for
      </span>
      <p className="mt-1 text-xs font-semibold leading-5 text-[var(--ui-text-muted)]">
        Shapes tone and AI generation guidance for this content. This doesn&rsquo;t control who can access the
        course — assign it to cohorts or learners from Programmes.
      </p>
      <textarea
        className="mt-3 min-h-24 w-full resize-none rounded-[14px] border border-[var(--ui-control-border)] bg-[var(--ui-surface-inset)] px-4 py-3 text-sm font-bold text-[var(--ui-text)] outline-none transition focus:border-[var(--ui-focus)]"
        defaultValue={defaultValue}
        name="intendedAudience"
        placeholder="e.g., Young adults with little prior exposure to how local civic institutions work."
      />
    </label>
  );
}
