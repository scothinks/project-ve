"use client";

import { useState } from "react";

export function CourseOutcomesField({ defaultValue }: { defaultValue: string[] }) {
  const [outcomes, setOutcomes] = useState(defaultValue.length > 0 ? defaultValue : [""]);

  function updateOutcome(index: number, next: string) {
    setOutcomes((current) => current.map((item, itemIndex) => (itemIndex === index ? next : item)));
  }

  function removeOutcome(index: number) {
    setOutcomes((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function addOutcome() {
    setOutcomes((current) => [...current, ""]);
  }

  return (
    <div>
      <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--admin-on-surface-variant)]">
        Learning Outcomes
      </span>
      <div className="mt-2 space-y-2">
        {outcomes.map((outcome, index) => (
          <div className="flex items-center gap-2" key={index}>
            <span className="text-[var(--admin-outline)]">⠿</span>
            <input
              className="min-h-10 flex-1 rounded-[14px] border border-[var(--admin-border-warm)] bg-[var(--admin-surface)] px-4 text-sm font-bold text-[var(--admin-on-surface)] outline-none transition focus:border-[var(--admin-primary)]"
              onChange={(event) => updateOutcome(index, event.target.value)}
              placeholder="e.g., Master conflict resolution techniques"
              value={outcome}
            />
            {outcomes.length > 1 ? (
              <button
                aria-label="Remove outcome"
                className="shrink-0 p-1 text-[var(--admin-on-surface-variant)] transition hover:text-[var(--admin-error)]"
                onClick={() => removeOutcome(index)}
                type="button"
              >
                ✕
              </button>
            ) : null}
          </div>
        ))}
      </div>
      <button
        className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-[var(--admin-primary)] hover:underline"
        onClick={addOutcome}
        type="button"
      >
        + Add Outcome
      </button>
      <input name="learningOutcomes" type="hidden" value={outcomes.filter((item) => item.trim()).join("\n")} />
    </div>
  );
}
