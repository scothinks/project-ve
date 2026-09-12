"use client";

import { useMemo, useState, useTransition } from "react";
import { markNotificationRead } from "@/app/notifications/actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { BellIcon, GiftIcon, InfoIcon, PersonCircleIcon, TrophyIcon } from "@/components/ui/Icons";
import { cn } from "@/lib/utils";
import type { UserNotification } from "@/lib/notifications";

const categoryMeta = {
  account: { icon: PersonCircleIcon, label: "Account", tone: "text-[var(--ui-mission)]" },
  missions: { icon: TrophyIcon, label: "Missions", tone: "text-[var(--ui-reward)]" },
  rewards: { icon: GiftIcon, label: "Rewards", tone: "text-[var(--ui-reward)]" },
  system: { icon: InfoIcon, label: "System", tone: "text-[var(--ui-text-muted)]" },
} as const;

const filters = ["all", "account", "missions", "rewards", "system"] as const;
type Filter = (typeof filters)[number];

function formatNotificationTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  }).format(new Date(value));
}

export function OrgNotificationsList({ notifications }: { notifications: UserNotification[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [isMarkingAll, startMarkAllTransition] = useTransition();
  const unreadIds = useMemo(
    () => notifications.filter((notification) => !notification.readAt).map((notification) => notification.id),
    [notifications],
  );

  function handleMarkAllRead() {
    startMarkAllTransition(async () => {
      await Promise.all(
        unreadIds.map((id) => {
          const formData = new FormData();
          formData.set("notificationId", id);
          return markNotificationRead(formData);
        }),
      );
    });
  }

  const visible = useMemo(
    () =>
      filter === "all"
        ? notifications
        : notifications.filter((notification) => notification.category === filter),
    [filter, notifications],
  );

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="hide-scrollbar flex gap-2 overflow-x-auto">
          {filters.map((item) => (
            <button
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-black capitalize transition-colors",
                filter === item
                  ? "border-[var(--ui-current-text)] bg-[var(--ui-current-bg)] text-[var(--ui-current-text)]"
                  : "border-[var(--ui-border-subtle)] bg-[var(--ui-surface)] text-[var(--ui-text-muted)]",
              )}
              key={item}
              onClick={() => setFilter(item)}
              type="button"
            >
              {item === "all" ? "All" : categoryMeta[item].label}
            </button>
          ))}
        </div>
        {unreadIds.length > 0 ? (
          <button
            className="shrink-0 text-xs font-black text-[var(--ui-action)] disabled:opacity-60"
            disabled={isMarkingAll}
            onClick={handleMarkAllRead}
            type="button"
          >
            {isMarkingAll ? "Marking..." : "Mark all read"}
          </button>
        ) : null}
      </div>

      {visible.length > 0 ? (
        <div className="mt-4 space-y-3 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4 lg:space-y-0">
          {visible.map((notification) => {
            const unread = !notification.readAt;
            const meta = categoryMeta[notification.category];

            return (
              <Card
                className={cn(
                  "rounded-[8px] p-0",
                  unread
                    ? "border border-[color:color-mix(in_srgb,var(--ui-current-text)_24%,var(--ui-border-subtle))] bg-[var(--ui-surface)]"
                    : "bg-[var(--ui-surface-muted)]",
                )}
                key={notification.id}
              >
                <div className="grid grid-cols-[1.5rem_1fr_auto] gap-2 p-4">
                  <span className={cn("mt-1 grid place-items-center", meta.tone)}>
                    <meta.icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-start gap-1.5">
                      <span className={cn("pt-1 text-[10px] font-black uppercase tracking-[0.1em]", meta.tone)}>
                        {meta.label}
                      </span>
                    </div>
                    <h2 className="mt-1 text-base font-black text-[var(--ui-text)]">{notification.title}</h2>
                    <p className="mt-1 text-sm font-medium leading-6 text-[var(--ui-text-muted)]">
                      {notification.body}
                    </p>
                  </div>
                  <div className="text-right text-[11px] font-medium text-[var(--ui-text-muted)]">
                    <span className="block">{formatNotificationTime(notification.createdAt)}</span>
                    {unread ? (
                      <span className="mt-2 inline-flex size-2 rounded-full bg-[var(--ui-current-text)]" />
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 px-4 pb-4">
                  {notification.ctaHref ? (
                    <Button className="h-9 px-4 text-sm" href={notification.ctaHref} variant="ghost">
                      {notification.ctaLabel ?? "Open"}
                    </Button>
                  ) : null}
                  {unread ? (
                    <form action={markNotificationRead}>
                      <input name="notificationId" type="hidden" value={notification.id} />
                      <Button className="h-9 px-4 text-sm" type="submit" variant="soft">
                        Read
                      </Button>
                    </form>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="mt-6 p-5">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-full bg-[var(--ui-surface-muted)] text-[var(--ui-text-muted)]">
              <BellIcon className="size-4" />
            </span>
            <h2 className="text-base font-black">No organisation notifications</h2>
          </div>
        </Card>
      )}
    </>
  );
}
