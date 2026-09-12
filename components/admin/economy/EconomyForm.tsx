"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormHTMLAttributes,
  type ReactNode,
} from "react";
import { useFormStatus } from "react-dom";
import { adminButtonClasses } from "@/components/admin/AdminPrimitives";

type Step = {
  id: string;
  title: string;
  description?: string;
  content: ReactNode;
};
type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function SaveAction({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <fieldset className="contents" disabled={pending} aria-busy={pending}>
      {children}
    </fieldset>
  );
}

/** Panels stay mounted: navigation never resets uncontrolled fields or file inputs. */
export function EconomyForm({
  steps,
  children,
  reviewAction,
  reviewNote,
  ...props
}: Omit<FormHTMLAttributes<HTMLFormElement>, "children"> & {
  steps: Step[];
  children?: ReactNode;
  reviewAction: ReactNode;
  reviewNote?: ReactNode;
}) {
  const form = useRef<HTMLFormElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const element = form.current;
    // React can defer synthetic events during an action transition. Cancel the
    // native reset synchronously so successful dry runs retain every field.
    const retainValues = (event: Event) => event.preventDefault();
    element?.addEventListener("reset", retainValues);
    return () => element?.removeEventListener("reset", retainValues);
  }, []);
  const [stepId, setStepId] = useState(steps[0]?.id ?? "review");
  const [showSteps, setShowSteps] = useState(false);
  const [summary, setSummary] = useState<
    Array<{ label: string; value: string; step?: string }>
  >([]);
  const current = steps.findIndex((step) => step.id === stepId);
  const reviewing = stepId === "review";
  const active = current < 0 && !reviewing ? 0 : current;
  const controls = () =>
    Array.from(
      form.current?.querySelectorAll<Control>("input, select, textarea") ?? [],
    );
  function invalidControl(panel?: string) {
    return controls().find(
      (control) =>
        (!panel ||
          control
            .closest("[data-economy-step]")
            ?.getAttribute("data-economy-step") === panel) &&
        !control.disabled &&
        control.willValidate &&
        !control.validity.valid,
    );
  }
  function showInvalid(control: Control) {
    const panel = control
      .closest("[data-economy-step]")
      ?.getAttribute("data-economy-step");
    if (panel) setStepId(panel);
    requestAnimationFrame(() => {
      control.focus();
      control.reportValidity();
    });
  }
  function navigate(target: string, validate = false) {
    const invalid = validate ? invalidControl(steps[active]?.id) : undefined;
    if (invalid) return showInvalid(invalid);
    if (target === "review") {
      const invalid = invalidControl();
      if (invalid) return showInvalid(invalid);
      setSummary(
        controls().flatMap((control) => {
          if (
            (!control.name && !control.labels?.length) ||
            control.type === "hidden" ||
            control.type === "file" ||
            control.dataset.economyReview === "exclude" ||
            control.disabled
          )
            return [];
          if (
            control.type === "radio" &&
            !(control as HTMLInputElement).checked
          )
            return [];
          const label =
            control.labels?.[0]?.querySelector("span")?.textContent?.trim() ||
            control.getAttribute("aria-label") ||
            control.name.replace(/([A-Z])/g, " $1");
          const value =
            control instanceof HTMLSelectElement
              ? control.selectedOptions[0]?.textContent?.trim()
              : control.type === "checkbox"
                ? (control as HTMLInputElement).checked
                  ? "Yes"
                  : "No"
                : control.value;
          const step =
            control
              .closest("[data-economy-step]")
              ?.getAttribute("data-economy-step") ?? undefined;
          return value ? [{ label, value, step }] : [];
        }),
      );
    }
    setStepId(target);
    setShowSteps(false);
    requestAnimationFrame(() => heading.current?.focus());
  }
  return (
    <form
      {...props}
      ref={form}
      noValidate
      onSubmit={(event) => {
        if (!reviewing) {
          event.preventDefault();
          navigate(steps[active + 1]?.id ?? "review", true);
          return;
        }
        const invalid = invalidControl();
        if (invalid) {
          event.preventDefault();
          showInvalid(invalid);
          return;
        }
        props.onSubmit?.(event);
      }}
    >
      <div className="mb-6">
        <button
          type="button"
          aria-expanded={showSteps}
          onClick={() => setShowSteps(!showSteps)}
          className="mb-3 text-sm font-semibold sm:hidden"
        >
          Step {reviewing ? steps.length + 1 : active + 1} of {steps.length + 1}
          : {reviewing ? "Review" : steps[active]?.title} ▾
        </button>
        <nav
          aria-label="Setup steps"
          className={`${showSteps ? "flex" : "hidden"} flex-wrap gap-2 sm:flex`}
        >
          {[...steps, { id: "review", title: "Review" }].map((step, index) => (
            <button
              aria-current={
                step.id === (reviewing ? "review" : steps[active]?.id)
                  ? "step"
                  : undefined
              }
              className={`rounded-full border px-4 py-2 text-sm font-semibold ${step.id === (reviewing ? "review" : steps[active]?.id) ? "border-[var(--ui-action)] bg-[var(--ui-action-soft)] text-[var(--ui-action)]" : "border-[var(--ui-border-subtle)] text-[var(--ui-text-muted)]"}`}
              key={step.id}
              onClick={() => navigate(step.id, index > active)}
              type="button"
            >
              {index + 1}. {step.title}
            </button>
          ))}
        </nav>
      </div>
      <h2
        className="mb-2 text-2xl font-semibold outline-none"
        ref={heading}
        tabIndex={-1}
      >
        {reviewing ? "Review before saving" : steps[active]?.title}
      </h2>
      {!reviewing && steps[active]?.description ? (
        <p className="mb-5 text-sm text-[var(--ui-text-muted)]">
          {steps[active].description}
        </p>
      ) : null}
      {steps.map((step, index) => (
        <div
          className="space-y-5"
          data-economy-step={step.id}
          hidden={reviewing || index !== active}
          key={step.id}
        >
          {step.content}
        </div>
      ))}
      {reviewing ? (
        <div className="space-y-5">
          {reviewNote}
          <dl className="grid gap-4 rounded-[16px] bg-[var(--ui-surface-inset)] p-5 sm:grid-cols-2">
            {summary.map((item, index) => (
              <div className="min-w-0" key={`${item.label}-${index}`}>
                <dt className="text-xs font-semibold capitalize text-[var(--ui-text-muted)]">
                  {item.label}
                </dt>
                <dd className="mt-1 whitespace-pre-wrap break-words text-sm">
                  {item.value}
                </dd>
                {item.step ? (
                  <button
                    className="mt-1 text-xs font-semibold text-[var(--ui-action)] underline"
                    type="button"
                    aria-label={`Edit ${item.label}`}
                    onClick={() => navigate(item.step!)}
                  >
                    Edit
                  </button>
                ) : null}
              </div>
            ))}
          </dl>
        </div>
      ) : null}
      {children}
      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-[var(--ui-border-subtle)] pt-5">
        {reviewing || active > 0 ? (
          <button
            className={adminButtonClasses("secondary")}
            onClick={() =>
              navigate(
                reviewing ? steps[steps.length - 1].id : steps[active - 1].id,
              )
            }
            type="button"
          >
            Back
          </button>
        ) : null}
        {reviewing ? (
          <SaveAction>{reviewAction}</SaveAction>
        ) : (
          <button
            className={adminButtonClasses("primary")}
            onClick={() => navigate(steps[active + 1]?.id ?? "review", true)}
            type="button"
          >
            {active === steps.length - 1 ? "Review" : "Continue"} →
          </button>
        )}
      </div>
    </form>
  );
}
