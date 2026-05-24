"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useFormStatus } from "react-dom";

type PendingSubmitButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  label: ReactNode;
  pendingLabel: ReactNode;
  pendingValue?: string;
  statusFieldName?: string;
};

export function PendingSubmitButton({
  className,
  disabled,
  label,
  name,
  pendingLabel,
  pendingValue,
  statusFieldName,
  value,
  ...props
}: PendingSubmitButtonProps) {
  const { pending, data } = useFormStatus();
  const fieldName = statusFieldName ?? name;
  const expectedValue = pendingValue ?? (typeof value === "string" ? value : undefined);
  const submittedValue = fieldName ? data?.get(fieldName) : null;
  const isCurrentAction =
    pending
    && (
      !fieldName
      || expectedValue === undefined
      || String(submittedValue ?? "") === expectedValue
    );

  return (
    <button
      {...props}
      className={className}
      disabled={disabled || pending}
      name={name}
      value={value}
    >
      {isCurrentAction ? pendingLabel : label}
    </button>
  );
}
