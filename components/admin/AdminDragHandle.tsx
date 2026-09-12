"use client";

import type { DraggableAttributes, DraggableSyntheticListeners } from "@dnd-kit/core";
import { AdminDragHandleIcon } from "@/components/admin/AdminIcons";
import { cn } from "@/lib/utils";

export function AdminDragHandle({
  attributes,
  className,
  label,
  listeners,
}: {
  attributes: DraggableAttributes;
  className?: string;
  label: string;
  listeners: DraggableSyntheticListeners;
}) {
  return (
    <button
      aria-label={`Drag to reorder ${label}`}
      className={cn(
        "flex h-9 w-9 shrink-0 touch-none items-center justify-center rounded-[10px] text-[var(--ui-text-muted)] hover:text-[var(--ui-text-muted)]",
        className,
      )}
      type="button"
      {...attributes}
      {...listeners}
    >
      <AdminDragHandleIcon className="h-4 w-4" />
    </button>
  );
}
