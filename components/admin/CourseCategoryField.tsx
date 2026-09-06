"use client";

import { useMemo, useState } from "react";
import { ChevronRightIcon } from "@/components/ui/Icons";

const CREATE_CATEGORY_VALUE = "__create_new_category__";

type CourseCategoryFieldProps = {
  categories: string[];
  currentCategory: string;
};

export function CourseCategoryField({
  categories,
  currentCategory,
}: CourseCategoryFieldProps) {
  const categoryOptions = useMemo(
    () =>
      Array.from(
        new Set([
          currentCategory,
          "Values Education",
          ...categories,
        ].filter(Boolean)),
      ),
    [categories, currentCategory],
  );

  const currentMatchesExisting = categoryOptions.includes(currentCategory);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState(
    currentMatchesExisting ? currentCategory : CREATE_CATEGORY_VALUE,
  );
  const [customValue, setCustomValue] = useState(
    currentMatchesExisting ? "" : currentCategory,
  );

  const selectedLabel =
    selectedValue === CREATE_CATEGORY_VALUE
      ? customValue.trim() || "Create new category..."
      : selectedValue;

  return (
    <div className="mt-4">
      <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--admin-on-surface-variant)]">
        Category
      </span>
      <input
        name="category"
        type="hidden"
        value={selectedValue === CREATE_CATEGORY_VALUE ? (categoryOptions[0] ?? "Values Education") : selectedValue}
      />
      <div className="relative mt-2">
        <button
          className="flex min-h-[52px] w-full items-center justify-between rounded-[14px] border border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] px-4 py-3 text-left text-sm font-bold text-[var(--admin-on-surface)] outline-none transition focus:border-[var(--admin-primary)] focus:ring-4 focus:ring-[color:color-mix(in_srgb,var(--admin-primary)_10%,transparent)]"
          onClick={() => setIsOpen((current) => !current)}
          type="button"
        >
          <span className="truncate">{selectedLabel}</span>
          <ChevronRightIcon
            className={`h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)] transition ${isOpen ? "-rotate-90" : "rotate-90"}`}
          />
        </button>
        {isOpen ? (
          <div className="absolute z-20 mt-2 max-h-72 w-full overflow-y-auto rounded-[16px] border border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] p-2 shadow-xl">
            <div className="space-y-1">
              {categoryOptions.map((category) => (
                <button
                  className={`flex w-full items-center justify-between rounded-[12px] px-3 py-3 text-left text-sm font-bold transition ${
                    selectedValue === category
                      ? "bg-[color:color-mix(in_srgb,var(--admin-primary-fixed)_78%,var(--admin-surface-milk))] text-[var(--admin-primary)]"
                      : "text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-container-low)]"
                  }`}
                  key={category}
                  onClick={() => {
                    setSelectedValue(category);
                    setIsOpen(false);
                  }}
                  type="button"
                >
                  <span>{category}</span>
                  {selectedValue === category ? <span>✓</span> : null}
                </button>
              ))}
              <button
                className={`flex w-full items-center justify-between rounded-[12px] px-3 py-3 text-left text-sm font-bold transition ${
                  selectedValue === CREATE_CATEGORY_VALUE
                    ? "bg-[color:color-mix(in_srgb,var(--admin-primary-fixed)_78%,var(--admin-surface-milk))] text-[var(--admin-primary)]"
                    : "text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-container-low)]"
                }`}
                onClick={() => {
                  setSelectedValue(CREATE_CATEGORY_VALUE);
                  setIsOpen(false);
                }}
                type="button"
              >
                <span>Create new category...</span>
                {selectedValue === CREATE_CATEGORY_VALUE ? <span>✓</span> : null}
              </button>
            </div>
          </div>
        ) : null}
      </div>
      {selectedValue === CREATE_CATEGORY_VALUE ? (
        <label className="mt-4 block">
          <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--admin-on-surface-variant)]">
            New category name
          </span>
          <input
            className="mt-2 w-full rounded-[14px] border border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] px-4 py-3 text-sm font-bold text-[var(--admin-on-surface)] outline-none transition focus:border-[var(--admin-primary)] focus:ring-4 focus:ring-[color:color-mix(in_srgb,var(--admin-primary)_10%,transparent)]"
            name="categoryCustom"
            onChange={(event) => setCustomValue(event.target.value)}
            placeholder="Type the new category name"
            value={customValue}
          />
        </label>
      ) : (
        <input name="categoryCustom" type="hidden" value="" />
      )}
    </div>
  );
}
