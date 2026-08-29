"use client";

import * as Tabs from "@radix-ui/react-tabs";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { cn } from "@/lib/utils";

type LessonWorkspaceTab = "index" | "workspace" | "review";

const tabs: Array<{ label: string; value: LessonWorkspaceTab }> = [
  { label: "Index", value: "index" },
  { label: "Workspace", value: "workspace" },
  { label: "Review", value: "review" },
];

function normalizeTab(value: string | undefined): LessonWorkspaceTab {
  if (value === "index" || value === "workspace" || value === "review") {
    return value;
  }

  return "workspace";
}

export function LessonWorkspaceTabs({
  defaultTab,
  index,
  review,
  workspace,
}: {
  defaultTab?: string;
  index: ReactNode;
  review: ReactNode;
  workspace: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const initialTab = useMemo(() => normalizeTab(defaultTab), [defaultTab]);
  const [activeTab, setActiveTab] = useState<LessonWorkspaceTab>(initialTab);

  useEffect(() => {
    setActiveTab(normalizeTab(searchParams.get("tab") ?? undefined));
  }, [searchParams]);

  function selectTab(value: string) {
    const nextTab = normalizeTab(value);
    setActiveTab(nextTab);
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (nextTab === "workspace") {
        params.delete("tab");
      } else {
        params.set("tab", nextTab);
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  }

  return (
    <Tabs.Root className="space-y-6" onValueChange={selectTab} value={activeTab}>
      <div className="sticky top-20 z-10 -mx-5 border-y border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)]/95 px-5 py-3 backdrop-blur md:-mx-8 md:px-8">
        <Tabs.List aria-label="Lesson workspace sections" className="hide-scrollbar flex gap-2 overflow-x-auto">
          {tabs.map((tab) => (
            <Tabs.Trigger
              aria-busy={isPending ? "true" : undefined}
              className={cn(
                "shrink-0 rounded-[12px] border border-transparent px-4 py-2 text-sm font-black text-[var(--admin-on-surface-variant)] outline-none transition hover:bg-[var(--admin-surface-container-low)] hover:text-[var(--admin-on-surface)] data-[state=active]:border-[color:color-mix(in_srgb,var(--admin-primary-container)_20%,var(--admin-border-warm))] data-[state=active]:bg-[color:color-mix(in_srgb,var(--admin-primary-container)_12%,transparent)] data-[state=active]:text-[var(--admin-primary)]",
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

      <Tabs.Content className="outline-none" value="index">
        {index}
      </Tabs.Content>
      <Tabs.Content className="outline-none" value="workspace">
        {workspace}
      </Tabs.Content>
      <Tabs.Content className="outline-none" value="review">
        {review}
      </Tabs.Content>
    </Tabs.Root>
  );
}
