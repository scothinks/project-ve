"use client";
import { useState, type ReactNode } from "react";
export function StockMethod({
  quantity,
  batch,
  defaultMethod = "quantity",
}: {
  quantity: ReactNode;
  batch: ReactNode;
  defaultMethod?: string;
}) {
  const [method, setMethod] = useState(defaultMethod);
  return (
    <section className="max-w-5xl">
      <fieldset className="mb-5">
        <legend className="mb-3 text-lg font-semibold">
          How are you adding stock?
        </legend>
        <div className="flex flex-wrap gap-3">
          {[
            ["quantity", "Quantity allocation"],
            ["batch", "Voucher or QR batch"],
          ].map(([value, label]) => (
            <label
              className="flex cursor-pointer gap-3 rounded-xl border border-[var(--ui-control-border)] bg-[var(--ui-surface)] p-4"
              key={value}
            >
              <input
                checked={method === value}
                name="stockMethod"
                onChange={() => setMethod(value)}
                type="radio"
                value={value}
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <div hidden={method !== "quantity"}>{quantity}</div>
      <div hidden={method !== "batch"}>{batch}</div>
    </section>
  );
}
