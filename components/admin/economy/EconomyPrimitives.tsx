import Link from "next/link";
import { displayFont } from "@/app/fonts/display";
import { AdminPageHeader } from "@/components/admin/AdminPrimitives";
import type { ComponentProps, ReactNode } from "react";
import {
  storefrontChecklist,
  type StorefrontInput,
} from "@/features/reward-economy/vocabulary";

export function EconomyCard({
  title,
  href,
  eyebrow,
  children,
  actions,
}: {
  title: string;
  href: string;
  eyebrow?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <article className="flex min-w-0 flex-col rounded-[18px] border border-[var(--ui-border-subtle)] bg-[var(--ui-surface)] p-5 sm:p-6">
      {eyebrow ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--ui-text-muted)]">
          {eyebrow}
        </div>
      ) : null}
      <h2 className="text-xl font-semibold tracking-tight">
        <Link className="hover:text-[var(--ui-action)]" href={href}>
          {title}
        </Link>
      </h2>
      <div className="mt-3 flex-1 space-y-3 text-sm leading-6 text-[var(--ui-text-muted)]">
        {children}
      </div>
      {actions ? (
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[var(--ui-border-subtle)] pt-4">
          {actions}
        </div>
      ) : null}
    </article>
  );
}
export function StorefrontChecklist({ reward }: { reward: StorefrontInput }) {
  const { state, checks } = storefrontChecklist(reward);
  return (
    <details className="rounded-[12px] bg-[var(--ui-surface-inset)] p-3">
      <summary className="cursor-pointer font-semibold text-[var(--ui-text)]">
        Store visibility · {state}
      </summary>
      <ul className="mt-3 space-y-2">
        {checks.map((check) => (
          <li className="flex gap-2" key={check.label}>
            <span aria-hidden="true">
              {check.neutral ? "—" : check.pass ? "✓" : "○"}
            </span>
            <span>
              {check.label}
              <span className="sr-only">
                :{" "}
                {check.neutral
                  ? "Intentional restriction"
                  : check.pass
                    ? "Passed"
                    : "Not met"}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

export function EconomyPageHeader(
  props: ComponentProps<typeof AdminPageHeader>,
) {
  return (
    <div className={displayFont.variable}>
      <AdminPageHeader {...props} />
    </div>
  );
}
