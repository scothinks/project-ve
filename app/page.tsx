import { Button } from "@/components/ui/Button";

export default function WelcomePage() {
  return (
    <main className="mobile-shell flex min-h-screen flex-col px-9 py-16">
      <div className="flex items-center justify-between">
        <p className="text-2xl font-bold">Project VE</p>
        <Button href="/login" variant="soft" className="h-9 px-5 text-xs">
          Skip
        </Button>
      </div>

      <section className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="relative grid size-48 place-items-center rounded-[42px] bg-[#dff2e9]">
          <div className="absolute -right-4 top-8 size-12 rounded-[18px] bg-[#008751]" />
          <div className="absolute -left-5 bottom-8 size-10 rounded-full bg-[#f1c84b]" />
          <div className="grid size-28 place-items-center rounded-[32px] bg-[var(--ve-card)] shadow-[0_18px_35px_rgba(0,0,0,0.08)]">
            <span className="text-5xl font-black text-[#008751]">VE</span>
          </div>
        </div>

        <h1 className="mt-14 text-[25px] font-bold leading-none">Complete a Lesson</h1>
        <p className="mt-5 max-w-[287px] text-[13px] font-medium leading-5 text-[var(--ve-muted)]">
          Learn practical civic values, take quick flash tests, and earn XP for
          each step you complete.
        </p>

        <div className="mt-20 flex gap-1.5">
          <span className="size-2.5 rounded-full bg-[#008751]" />
          <span className="size-2.5 rounded-full bg-[#c9c9c9]" />
          <span className="size-2.5 rounded-full bg-[#c9c9c9]" />
        </div>
      </section>

      <Button href="/login" className="w-full">
        Next
      </Button>
      <div className="mx-auto mt-7 h-1 w-[102px] rounded-full bg-[#d4d4d4]" />
    </main>
  );
}
