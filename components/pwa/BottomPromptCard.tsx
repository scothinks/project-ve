"use client";

import type { ReactNode } from "react";

type BottomPromptCardProps = {
  action?: ReactNode;
  children?: ReactNode;
  description?: ReactNode;
  dismissAriaLabel: string;
  eyebrow: ReactNode;
  onDismiss: () => void;
  title: ReactNode;
  trailing?: ReactNode;
};

export function BottomPromptCard({
  action,
  children,
  description,
  dismissAriaLabel,
  eyebrow,
  onDismiss,
  title,
  trailing,
}: BottomPromptCardProps) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div className="pointer-events-auto w-full max-w-[420px] rounded-[22px] border border-[#efe7da] bg-[var(--ve-shell)] p-4 shadow-[0_18px_40px_rgba(16,16,16,0.14)]">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#087f5b]">
              {eyebrow}
            </p>
            <p className="mt-1 text-sm font-black text-[var(--foreground)]">
              {title}
            </p>
            {description ? (
              <div className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
                {description}
              </div>
            ) : null}
          </div>

          {action}
          {trailing}

          <button
            aria-label={dismissAriaLabel}
            className="h-9 w-9 shrink-0 rounded-full bg-[var(--ve-panel)] text-lg font-black text-[var(--ve-muted-strong)]"
            onClick={onDismiss}
            type="button"
          >
            ×
          </button>
        </div>

        {children ? <div className="mt-3">{children}</div> : null}
      </div>
    </div>
  );
}
