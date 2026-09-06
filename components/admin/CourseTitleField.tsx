"use client";

import { useState } from "react";

const MAX_TITLE_LENGTH = 60;

export function CourseTitleField({ defaultValue }: { defaultValue: string }) {
  const [title, setTitle] = useState(defaultValue);
  const remaining = MAX_TITLE_LENGTH - title.length;

  return (
    <label className="block">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--admin-on-surface-variant)]">
          Title
        </span>
        <span
          className={
            remaining < 0
              ? "text-[11px] font-bold text-[var(--admin-error)]"
              : "text-[11px] font-bold text-[var(--admin-on-surface-variant)]"
          }
        >
          {title.length}/{MAX_TITLE_LENGTH}
        </span>
      </div>
      <input
        className="mt-2 w-full rounded-[14px] border border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] px-4 py-3 text-sm font-bold text-[var(--admin-on-surface)] outline-none transition focus:border-[var(--admin-primary)] focus:ring-4 focus:ring-[color:color-mix(in_srgb,var(--admin-primary)_10%,transparent)]"
        maxLength={MAX_TITLE_LENGTH}
        name="title"
        onChange={(event) => setTitle(event.target.value)}
        required
        value={title}
      />
    </label>
  );
}
