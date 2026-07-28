"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon } from "@/components/ui/Icons";
import { LoginForm } from "./LoginForm";

const defaultView = {
  title: "Login",
  subtitle: "Enter your email address to login.",
};

export default function LoginPage() {
  const [view, setView] = useState(defaultView);

  return (
    <main className="min-h-screen overflow-hidden bg-[var(--ve-shell)] lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(440px,560px)]">
      <section className="hidden min-h-screen flex-col justify-between bg-[radial-gradient(circle_at_20%_12%,rgba(var(--ve-green-rgb),0.14),transparent_30rem),linear-gradient(135deg,var(--ve-shell),var(--background))] px-12 py-10 lg:flex">
        <Link
          aria-label="Back to welcome"
          className="grid size-11 place-items-center rounded-full border border-[var(--ve-line-soft)] bg-[var(--ve-card)] text-[var(--foreground)] shadow-[0_14px_34px_rgba(var(--ve-shadow-rgb),0.08)]"
          href="/"
        >
          <ArrowLeftIcon className="h-6 w-6" />
        </Link>

        <div className="max-w-xl">
          <div className="grid size-16 place-items-center rounded-[24px] bg-[#087f5b] text-[1.35rem] font-black tracking-[-0.04em] text-white shadow-[0_24px_60px_rgba(18,60,53,0.22)]">
            VE
          </div>
          <p className="mt-8 text-xs font-black uppercase tracking-[0.18em] text-[var(--ve-green)]">
            Project VE: Values Education
          </p>
          <h1 className="mt-4 max-w-[12ch] text-[clamp(3rem,5vw,5.25rem)] font-black leading-[0.95] tracking-[-0.065em] text-[var(--foreground)]">
            Learn, Earn, Spend.
          </h1>
          <p className="mt-6 max-w-md text-lg font-semibold leading-8 text-[var(--ve-muted-strong)]">
            An incentivized learning space focused on teaching young people good values.
          </p>
        </div>

        <div aria-hidden="true" />
      </section>

      <section className="flex min-h-screen flex-col bg-[var(--ve-card)] px-7 py-10 sm:px-9 lg:px-14 lg:py-10 lg:shadow-[-28px_0_80px_rgba(var(--ve-shadow-rgb),0.08)]">
        <div className="mx-auto flex w-full max-w-[430px] flex-1 flex-col">
          <Link
            aria-label="Back to welcome"
            className="inline-flex text-[var(--foreground)] lg:hidden"
            href="/"
          >
            <ArrowLeftIcon className="h-7 w-7" />
          </Link>

          <div className="mt-12 lg:my-auto lg:mt-0">
            <h1 className="text-[30px] font-bold leading-none tracking-[-0.04em] lg:text-[2.35rem]">
              {view.title}
            </h1>
            <p className="mt-4 text-[13px] font-medium text-[var(--ve-muted)] lg:text-sm">
              {view.subtitle}
            </p>
            <LoginForm onViewChange={setView} />
          </div>

          <div className="mx-auto mt-12 h-1 w-[102px] rounded-full bg-[var(--ve-line)] lg:hidden" />
        </div>
      </section>
    </main>
  );
}
