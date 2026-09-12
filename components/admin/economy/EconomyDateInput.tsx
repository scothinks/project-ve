"use client";
import { useRef, type InputHTMLAttributes } from "react";
/** Retains the browser's date/time control and the existing submitted field name. */
export function EconomyDateInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <span className="block">
      <input {...props} ref={input} type="datetime-local" />
      {!props.required ? (
        <button
          className="mt-2 text-xs font-semibold text-[var(--ui-action)] underline"
          onClick={(event) => {
            event.preventDefault();
            if (input.current) {
              const setter = Object.getOwnPropertyDescriptor(
                HTMLInputElement.prototype,
                "value",
              )?.set;
              setter?.call(input.current, "");
              input.current.dispatchEvent(
                new Event("input", { bubbles: true }),
              );
              input.current.dispatchEvent(
                new Event("change", { bubbles: true }),
              );
              input.current.focus();
            }
          }}
          type="button"
        >
          {props.name?.toLowerCase().includes("start") ||
          props.name === "availableFrom"
            ? "No start date"
            : "No end date"}
        </button>
      ) : null}
    </span>
  );
}
