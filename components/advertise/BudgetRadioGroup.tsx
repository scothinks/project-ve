"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type BudgetOption = {
  value: string;
  label: string;
};

type BudgetRadioGroupProps = {
  name: string;
  options: BudgetOption[];
  defaultValue?: string;
};

export function BudgetRadioGroup({ name, options, defaultValue = "" }: BudgetRadioGroupProps) {
  const [selected, setSelected] = useState(defaultValue);

  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {options.map((option) => (
        <label
          className={cn(
            "flex cursor-pointer items-center gap-3 rounded-[14px] border p-3.5 transition",
            selected === option.value
              ? "!border-[var(--ve-green)] !bg-[var(--ve-green-soft)]"
              : "!border-[var(--ve-line)] !bg-[var(--ve-card)]",
          )}
          key={option.label}
        >
          <input
            checked={selected === option.value}
            className="size-4 accent-[var(--ve-green)]"
            name={name}
            onChange={() => setSelected(option.value)}
            type="radio"
            value={option.value}
          />
          <span className="text-sm font-bold">{option.label}</span>
        </label>
      ))}
    </div>
  );
}
