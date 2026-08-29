"use client";

import * as Tabs from "@radix-ui/react-tabs";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { cn } from "@/lib/utils";

type CourseWorkspaceTab = "overview" | "curriculum" | "media" | "review-publish";

const tabs: Array<{ label: string; value: CourseWorkspaceTab }> = [
  { label: "Overview", value: "overview" },
  { label: "Curriculum", value: "curriculum" },
  { label: "Media", value: "media" },
  { label: "Review & Publish", value: "review-publish" },
];

function normalizeTab(value: string | undefined): CourseWorkspaceTab {
  if (
    value === "overview"
    || value === "curriculum"
    || value === "media"
    || value === "review-publish"
  ) {
    return value;
  }

  return "overview";
}

export function CourseWorkspaceTabs({
  curriculum,
  defaultTab,
  media,
  overview,
  reviewPublish,
}: {
  curriculum: ReactNode;
  defaultTab?: string;
  media: ReactNode;
  overview: ReactNode;
  reviewPublish: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const initialTab = useMemo(() => normalizeTab(defaultTab), [defaultTab]);
  const [activeTab, setActiveTab] = useState<CourseWorkspaceTab>(initialTab);

  useEffect(() => {
    setActiveTab(normalizeTab(searchParams.get("tab") ?? undefined));
  }, [searchParams]);

  function selectTab(value: string) {
    const nextTab = normalizeTab(value);
    setActiveTab(nextTab);
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (nextTab === "overview") {
        params.delete("tab");
      } else {
        params.set("tab", nextTab);
      }
      params.delete("lessonsPage");
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  }

  return (
    <Tabs.Root className="space-y-6" value={activeTab} onValueChange={selectTab}>
      <div className="sticky top-20 z-10 -mx-5 border-y border-[var(--ve-line-soft)] bg-[var(--ve-shell)]/95 px-5 py-3 backdrop-blur md:-mx-8 md:px-8">
        <Tabs.List
          aria-label="Course workspace sections"
          className="hide-scrollbar flex gap-2 overflow-x-auto"
        >
          {tabs.map((tab) => (
            <Tabs.Trigger
              aria-busy={isPending ? "true" : undefined}
              className={cn(
                "shrink-0 rounded-[12px] border border-transparent px-4 py-2 text-sm font-black text-[var(--ve-muted-strong)] outline-none transition hover:bg-[var(--ve-panel)] hover:text-[var(--foreground)] focus-visible:ring-4 focus-visible:ring-[color:color-mix(in_srgb,var(--ve-green)_14%,transparent)] data-[state=active]:border-[color:color-mix(in_srgb,var(--ve-green)_20%,var(--ve-line-soft))] data-[state=active]:bg-[color:color-mix(in_srgb,var(--ve-green-soft)_82%,var(--ve-card))] data-[state=active]:text-[var(--ve-green)]",
                isPending && "opacity-80",
              )}
              key={tab.value}
              value={tab.value}
            >
              {tab.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
      </div>

      <Tabs.Content className="outline-none" value="overview">
        {overview}
      </Tabs.Content>
      <Tabs.Content className="outline-none" value="curriculum">
        {curriculum}
      </Tabs.Content>
      <Tabs.Content className="outline-none" value="media">
        {media}
      </Tabs.Content>
      <Tabs.Content className="outline-none" value="review-publish">
        {reviewPublish}
      </Tabs.Content>
    </Tabs.Root>
  );
}
