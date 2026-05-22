import Link from "next/link";
import { ArrowLeftIcon } from "@/components/ui/Icons";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="mobile-shell min-h-screen px-9 py-16">
      <Link aria-label="Back to welcome" className="inline-flex text-[var(--foreground)]" href="/">
        <ArrowLeftIcon className="h-7 w-7" />
      </Link>

      <section className="mt-12">
        <h1 className="text-[30px] font-bold leading-none">Login</h1>
        <p className="mt-4 text-[13px] font-medium text-[var(--ve-muted)]">
          Enter your email address to login.
        </p>
        <LoginForm />
      </section>

      <div className="mt-12 rounded-[12px] bg-[#f2e1d3] px-4 py-3 text-center text-xs font-black text-[#3f2215]">
        DARKER &amp; RICHER. Because of you.
      </div>
      <div className="mx-auto mt-28 h-1 w-[102px] rounded-full bg-[#d4d4d4]" />
    </main>
  );
}
