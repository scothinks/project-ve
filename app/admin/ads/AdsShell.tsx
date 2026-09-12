import type { ReactNode } from "react";
import {
  AdminNoticeBanner,
  AdminPageHeader,
} from "@/components/admin/AdminPrimitives";
import { cn } from "@/lib/utils";
import type { AdminAdsView } from "./types";

export function AdsShell({
  activeView,
  children,
  notice,
}: {
  activeView: AdminAdsView;
  children: ReactNode;
  notice?: string;
}) {
  return (
    <>
      <AdminPageHeader
        backHref="/admin"
        backLabel="Admin overview"
        eyebrow="Direct ads"
        title="Ads Manager"
        subtitle="Plan, launch, govern, and report first-party sponsorship campaigns without exposing operational complexity by default."
      />
      {notice ? <AdminNoticeBanner>{notice}</AdminNoticeBanner> : null}

      <section className="mt-6 rounded-[22px] border border-[var(--ui-border-subtle)] bg-[var(--ui-surface)] p-3 shadow-sm">
        <div className="grid gap-2 md:grid-cols-5">
          {[
            ["Overview", "/admin/ads", "overview"],
            ["Launch Studio", "/admin/ads/launch", "launch"],
            ["Review Queue", "/admin/ads/review", "review"],
            ["Reporting", "/admin/ads/reporting", "reporting"],
            ["Inventory Library", "/admin/ads/inventory", "inventory"],
          ].map(([label, href, view]) => (
            <a
              className={cn(
                "rounded-[16px] px-4 py-3 text-center text-sm font-black transition hover:bg-[var(--ui-surface-inset)] hover:text-[var(--ui-action)]",
                activeView === view
                  ? "bg-[var(--ui-surface-inset)] text-[var(--ui-action)]"
                  : "text-[var(--ui-text-muted)]",
              )}
              href={href}
              key={href}
            >
              {label}
            </a>
          ))}
        </div>
      </section>

      <div className="mt-8">{children}</div>
    </>
  );
}
