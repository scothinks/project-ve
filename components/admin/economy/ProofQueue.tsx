"use client";

import { useState, type ReactNode } from "react";
import { adminButtonClasses } from "@/components/admin/AdminPrimitives";

/** Keep each decision form mounted so skipping never discards a drafted reason. */
export function ProofQueue({
  items,
  children,
}: {
  items: Array<{ key: string; title: string; learner: string }>;
  children: ReactNode[];
}) {
  const [selected, setSelected] = useState(0);
  const [detail, setDetail] = useState(false);
  const active = Math.min(selected, items.length - 1);
  const select = (index: number) => {
    setSelected(index);
    setDetail(true);
  };
  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(200px,280px)_minmax(0,1fr)]">
      <nav
        aria-label="Submission queue"
        className={`${detail ? "hidden" : "block"} space-y-2 lg:block`}
      >
        {items.map((item, index) => (
          <button
            key={item.key}
            type="button"
            aria-current={active === index ? "true" : undefined}
            onClick={() => select(index)}
            className="block w-full rounded-xl border border-[var(--ui-border-subtle)] bg-[var(--ui-surface)] p-4 text-left aria-[current=true]:border-[var(--ui-action)] aria-[current=true]:bg-[var(--ui-action-soft)]"
          >
            <span className="block text-sm font-semibold">{item.title}</span>
            <span className="mt-1 block text-xs text-[var(--ui-text-muted)]">
              {item.learner}
            </span>
          </button>
        ))}
      </nav>
      <div className={`${detail ? "block" : "hidden"} min-w-0 lg:block`}>
        <button
          type="button"
          className="mb-3 text-sm font-semibold text-[var(--ui-action)] lg:hidden"
          onClick={() => setDetail(false)}
        >
          ← Back to queue
        </button>
        {children.map((child, index) => (
          <div hidden={index !== active} key={items[index].key}>
            {child}
          </div>
        ))}
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-[var(--ui-surface)] p-3">
          <span className="text-sm text-[var(--ui-text-muted)]">
            Submission {active + 1} of {items.length}
          </span>
          {items.length > 1 ? (
            <button
              type="button"
              className={adminButtonClasses("secondary")}
              onClick={() => select((active + 1) % items.length)}
            >
              Skip for now →
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
