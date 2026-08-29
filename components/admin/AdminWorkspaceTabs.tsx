"use client";

import * as Tabs from "@radix-ui/react-tabs";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export function AdminWorkspaceTabs({
  tabs,
  activeTab,
  paramName = "tab",
}: {
  tabs: Array<{ label: string; value: string }>;
  activeTab: string;
  paramName?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  function selectTab(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === tabs[0]?.value) {
      params.delete(paramName);
    } else {
      params.set(paramName, value);
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <Tabs.Root onValueChange={selectTab} value={activeTab}>
      <Tabs.List className="inline-flex items-center gap-1 rounded-[12px] bg-[var(--admin-surface-container-low)] p-1">
        {tabs.map((tab) => (
          <Tabs.Trigger
            className={cn(
              "rounded-[10px] px-4 py-2 text-sm font-bold text-[var(--admin-on-surface-variant)] transition data-[state=active]:bg-[var(--admin-surface-milk)] data-[state=active]:text-[var(--admin-on-surface)] data-[state=active]:shadow-sm",
            )}
            key={tab.value}
            value={tab.value}
          >
            {tab.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
    </Tabs.Root>
  );
}
