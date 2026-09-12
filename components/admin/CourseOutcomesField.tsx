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
      <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ui-text-muted)]">
        Learning Outcomes
      </span>
      <div className="mt-2 space-y-2">
        {outcomes.map((outcome, index) => (
          <div className="flex items-center gap-2" key={index}>
            <span className="text-[var(--ui-text-muted)]">⠿</span>
            <input
              className="min-h-10 flex-1 rounded-[14px] border border-[var(--ui-control-border)] bg-[var(--ui-surface-inset)] px-4 text-sm font-bold text-[var(--ui-text)] outline-none transition focus:border-[var(--ui-focus)]"
              onChange={(event) => updateOutcome(index, event.target.value)}
              placeholder="e.g., Master conflict resolution techniques"
              value={outcome}
            />
            {outcomes.length > 1 ? (
              <button
                aria-label="Remove outcome"
                className="shrink-0 p-1 text-[var(--ui-text-muted)] transition hover:text-[var(--ui-danger)]"
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
        className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-[var(--ui-action)] hover:underline"
        onClick={addOutcome}
        type="button"
      >
        + Add Outcome
      </button>
      <input name="learningOutcomes" type="hidden" value={outcomes.filter((item) => item.trim()).join("\n")} />
    </div>
  );
}
