"use client";

import * as Select from "@radix-ui/react-select";
import { useState } from "react";
import { ChevronRightIcon } from "@/components/ui/Icons";
import { cn } from "@/lib/utils";

export type AdminSelectOption = {
  label: string;
  value: string;
};

const sizeClasses = {
  default: "min-h-11 rounded-[14px] px-3",
  compact: "min-h-9 rounded-[12px] px-3 py-2",
};

export function AdminSelect({
  id,
  className,
  defaultValue,
  disabled,
  name,
  onValueChange,
  options,
  placeholder = "Select...",
  required,
  size = "default",
  value,
}: {
  id?: string;
  className?: string;
  defaultValue?: string;
  disabled?: boolean;
  name?: string;
  onValueChange?: (value: string) => void;
  options: AdminSelectOption[];
  placeholder?: string;
  required?: boolean;
  size?: "default" | "compact";
  value?: string;
}) {
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : internalValue;
  const selectedLabel = options.find((option) => option.value === currentValue)?.label;

  function handleValueChange(next: string) {
    if (!isControlled) {
      setInternalValue(next);
    }
    onValueChange?.(next);
  }

  return (
    <Select.Root
      disabled={disabled}
      name={name}
      onValueChange={handleValueChange}
      required={required}
      value={currentValue}
    >
      <Select.Trigger
        id={id}
        className={cn(
          "flex w-full items-center justify-between border border-[var(--ui-control-border)] bg-[var(--ui-surface)] text-left text-sm font-bold outline-none transition focus:border-[var(--ui-focus)] disabled:cursor-not-allowed disabled:opacity-60",
          sizeClasses[size],
          className,
        )}
      >
        <Select.Value placeholder={placeholder}>{selectedLabel ?? placeholder}</Select.Value>
        <Select.Icon className="shrink-0 text-[var(--ui-text-muted)]">
          <ChevronRightIcon className="h-4 w-4 rotate-90" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          className="z-50 overflow-hidden rounded-[14px] border border-[var(--ui-border-subtle)] bg-[var(--ui-surface)] p-1 shadow-xl"
          position="popper"
          sideOffset={6}
        >
          <Select.Viewport>
            {options.map((option) => (
              <Select.Item
                className="cursor-pointer rounded-[10px] px-3 py-2 text-sm font-bold outline-none data-[highlighted]:bg-[var(--ui-current-bg)] data-[highlighted]:text-[var(--ui-current-text)] data-[state=checked]:text-[var(--ui-current-text)]"
                key={option.value}
                value={option.value}
              >
                <Select.ItemText>{option.label}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
