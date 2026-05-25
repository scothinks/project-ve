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
    <main className="mobile-shell min-h-screen px-9 py-16">
      <Link aria-label="Back to welcome" className="inline-flex text-[var(--foreground)]" href="/">
        <ArrowLeftIcon className="h-7 w-7" />
      </Link>

      <section className="mt-12">
        <h1 className="text-[30px] font-bold leading-none">{view.title}</h1>
        <p className="mt-4 text-[13px] font-medium text-[var(--ve-muted)]">{view.subtitle}</p>
        <LoginForm onViewChange={setView} />
      </section>

      <div className="mt-12 rounded-[12px] bg-[color:color-mix(in_srgb,var(--ve-store-soft)_58%,var(--ve-card))] px-4 py-3 text-center text-xs font-black text-[color:color-mix(in_srgb,var(--ve-store)_32%,var(--foreground))]">
        DARKER &amp; RICHER. Because of you.
      </div>
      <div className="mx-auto mt-28 h-1 w-[102px] rounded-full bg-[var(--ve-line)]" />
    </main>
  );
}
