"use client";

import * as AlertDialog from "@radix-ui/react-alert-dialog";
import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AdminDrawer({
  children,
  onOpenChange,
  open,
  title,
  description,
  trigger,
  widthClassName = "w-full max-w-[420px]",
  onCloseAutoFocus,
}: {
  children: ReactNode;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  title: string;
  description?: string;
  trigger?: ReactNode;
  widthClassName?: string;
  onCloseAutoFocus?: (event: Event) => void;
}) {
  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open}>
      {trigger ? <Dialog.Trigger asChild>{trigger}</Dialog.Trigger> : null}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30 transition-opacity" />
        <Dialog.Content
          onCloseAutoFocus={onCloseAutoFocus}
          className={cn(
            "fixed right-0 top-0 z-50 flex h-full flex-col overflow-y-auto border-l border-[var(--ui-border-subtle)] bg-[var(--ui-surface)] shadow-2xl outline-none transition-transform",
            widthClassName,
          )}
        >
          <div className="flex items-start justify-between border-b border-[var(--ui-border-subtle)] px-6 py-5">
            <div>
              <Dialog.Title className="text-lg font-black text-[var(--ui-text)]">
                {title}
              </Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-sm text-[var(--ui-text-muted)]">
                  {description}
                </Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close
              aria-label="Close"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--ui-text-muted)] transition hover:bg-[var(--ui-surface-soft)]"
            >
              ✕
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function AdminConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger",
  onConfirm,
}: {
  trigger: ReactNode;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
  onConfirm: () => void;
}) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-[18px] border border-[var(--ui-border-subtle)] bg-[var(--ui-surface)] p-6 shadow-2xl outline-none">
          <AlertDialog.Title className="text-lg font-black text-[var(--ui-text)]">
            {title}
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm text-[var(--ui-text-muted)]">
            {description}
          </AlertDialog.Description>
          <div className="mt-6 flex justify-end gap-3">
            <AlertDialog.Cancel asChild>
              <button
                className="rounded-[12px] border border-[var(--ui-border-subtle)] px-4 py-2 text-sm font-bold text-[var(--ui-text)] transition hover:bg-[var(--ui-surface-soft)]"
                type="button"
              >
                {cancelLabel}
              </button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button
                className={cn(
                  "rounded-[12px] px-4 py-2 text-sm font-bold transition",
                  tone === "danger"
                    ? "bg-[var(--ui-danger)] text-[var(--ui-on-danger)] hover:brightness-95"
                    : "bg-[var(--ui-action)] text-[var(--ui-on-action)] hover:bg-[var(--ui-action-hover)] active:bg-[var(--ui-action-pressed)]",
                )}
                onClick={onConfirm}
                type="button"
              >
                {confirmLabel}
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
