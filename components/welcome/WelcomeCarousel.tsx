"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const WELCOME_SEEN_STORAGE_KEY = "ve_welcome_seen_v1";

type WelcomeCarouselProps = {
  destinationHref: string;
};

type WelcomeSlide = {
  id: string;
  anchor: string;
  title: string;
  description: string;
  accent: string;
  softAccent: string;
  glowRgb: string;
  art: ReactNode;
  artClassName?: string;
  contentClassName?: string;
};

function LessonArt({ accent, softAccent, glowRgb }: Pick<WelcomeSlide, "accent" | "softAccent" | "glowRgb">) {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[320px]">
      <div
        className="absolute inset-[10%] rounded-[34%] blur-[1px]"
        style={{ background: `radial-gradient(circle at 50% 42%, ${softAccent} 0%, transparent 72%)` }}
      />
      <div
        className="absolute left-[13%] top-[16%] h-[72%] w-[72%] rounded-[30%]"
        style={{ backgroundColor: softAccent, boxShadow: `0 32px 72px rgba(${glowRgb},0.12)` }}
      />
      <div
        className="absolute left-[24%] top-[28%] h-[46%] w-[46%] rounded-[24%] bg-[var(--ve-card)] p-5"
        style={{ boxShadow: "0 22px 44px rgba(var(--ve-shadow-rgb),0.12)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="grid h-11 w-11 shrink-0 place-items-center rounded-[16px] text-lg font-black text-white"
            style={{ backgroundColor: accent }}
          >
            1
          </div>
          <div className="min-w-0 flex-1">
            <div className="h-2.5 w-14 rounded-full bg-[var(--ve-panel)]" />
            <div className="mt-2 h-2.5 w-20 rounded-full bg-[var(--ve-panel)]" />
          </div>
        </div>
        <div className="mt-5 space-y-3">
          <div className="h-11 rounded-[16px] border border-[var(--ve-line-soft)] bg-[var(--ve-shell)]" />
          <div className="h-11 rounded-[16px] border border-[var(--ve-line-soft)] bg-[var(--ve-shell)]" />
          <div
            className="flex h-11 items-center justify-between rounded-[16px] border px-4"
            style={{ borderColor: accent, backgroundColor: `color-mix(in srgb, ${accent} 8%, var(--ve-shell))` }}
          >
            <div className="h-2.5 w-20 rounded-full bg-[var(--ve-card)]" />
            <div
              className="grid h-6 w-6 place-items-center rounded-full text-[0.8rem] font-black text-white"
              style={{ backgroundColor: accent }}
            >
              ✓
            </div>
          </div>
        </div>
      </div>
      <div
        className="absolute left-[6%] top-[57%] h-[15%] w-[15%] rounded-full"
        style={{ backgroundColor: "var(--ve-store)", boxShadow: "0 14px 28px rgba(var(--ve-store-rgb),0.24)" }}
      />
      <div
        className="absolute right-[8%] top-[28%] h-[18%] w-[18%] rounded-[34%]"
        style={{ backgroundColor: accent, boxShadow: `0 16px 30px rgba(${glowRgb},0.22)` }}
      />
    </div>
  );
}

function QuizArt({ accent, softAccent, glowRgb }: Pick<WelcomeSlide, "accent" | "softAccent" | "glowRgb">) {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[320px]">
      <div
        className="absolute inset-[12%] rounded-[32%]"
        style={{ backgroundColor: softAccent, boxShadow: `0 32px 72px rgba(${glowRgb},0.12)` }}
      />
      <div className="absolute left-[16%] top-[21%] rounded-[24px] bg-[var(--ve-card)] px-5 py-4 shadow-[0_22px_44px_rgba(var(--ve-shadow-rgb),0.10)]">
        <div className="flex gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: accent }} />
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--ve-store)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--ve-line)]" />
        </div>
        <div className="mt-4 space-y-3">
          <div className="h-3 w-28 rounded-full bg-[var(--ve-panel)]" />
          <div className="grid gap-2">
            <div className="h-10 rounded-[16px] border border-[var(--ve-line-soft)] bg-[var(--ve-shell)]" />
            <div
              className="h-10 rounded-[16px] border"
              style={{ borderColor: accent, backgroundColor: `color-mix(in srgb, ${accent} 10%, var(--ve-shell))` }}
            />
            <div className="h-10 rounded-[16px] border border-[var(--ve-line-soft)] bg-[var(--ve-shell)]" />
          </div>
        </div>
      </div>
      <div
        className="absolute right-[13%] top-[24%] grid h-[18%] w-[18%] place-items-center rounded-[30%] text-[1.45rem] font-black text-white"
        style={{ backgroundColor: accent, boxShadow: `0 14px 28px rgba(${glowRgb},0.22)` }}
      >
        XP
      </div>
      <div
        className="absolute bottom-[16%] right-[17%] rounded-full px-4 py-2 text-sm font-black"
        style={{
          backgroundColor: "var(--ve-store-soft)",
          color: "color-mix(in srgb, var(--ve-store) 80%, var(--foreground))",
          boxShadow: "0 14px 28px rgba(var(--ve-store-rgb),0.18)",
        }}
      >
        +25 XP
      </div>
    </div>
  );
}

function RewardsArt({ accent, softAccent, glowRgb }: Pick<WelcomeSlide, "accent" | "softAccent" | "glowRgb">) {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[320px]">
      <div
        className="absolute inset-[14%] rounded-[32%]"
        style={{ backgroundColor: softAccent, boxShadow: `0 32px 72px rgba(${glowRgb},0.14)` }}
      />
      <div className="absolute left-[14%] top-[24%] h-[44%] w-[34%] rounded-[26px] bg-[var(--ve-card)] p-4 shadow-[0_22px_44px_rgba(var(--ve-shadow-rgb),0.10)]">
        <div
          className="rounded-[18px] px-3 py-2 text-center text-xs font-black uppercase tracking-[0.14em]"
          style={{ backgroundColor: softAccent, color: accent }}
        >
          Mission
        </div>
        <div className="mt-4 h-3 w-14 rounded-full bg-[var(--ve-panel)]" />
        <div className="mt-3 h-3 w-20 rounded-full bg-[var(--ve-panel)]" />
        <div className="mt-5 h-2 rounded-full bg-[var(--ve-panel)]">
          <div className="h-full w-[68%] rounded-full" style={{ backgroundColor: accent }} />
        </div>
      </div>
      <div className="absolute right-[14%] top-[20%] h-[48%] w-[28%] rounded-[24px] bg-[var(--ve-card)] px-4 py-5 shadow-[0_22px_44px_rgba(var(--ve-shadow-rgb),0.10)]">
        <div className="text-center text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">
          Reward
        </div>
        <div className="mt-4 text-center text-[2rem] font-black" style={{ color: accent }}>
          2x
        </div>
        <div className="mt-2 text-center text-xs font-semibold text-[var(--ve-muted)]">XP Boost</div>
        <div
          className="mt-5 rounded-[16px] px-3 py-2 text-center text-xs font-black text-white"
          style={{ backgroundColor: accent }}
        >
          Active
        </div>
      </div>
      <div
        className="absolute bottom-[15%] left-[28%] rounded-full px-4 py-2 text-sm font-black text-white"
        style={{ backgroundColor: accent, boxShadow: `0 18px 36px rgba(${glowRgb},0.24)` }}
      >
        Keep going
      </div>
    </div>
  );
}

export function WelcomeCarousel({ destinationHref }: WelcomeCarouselProps) {
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(0);
  const [ready, setReady] = useState(false);

  const slides = useMemo<WelcomeSlide[]>(
    () => [
      {
        id: "learn",
        anchor: "Learn",
        title: "Practical civic values",
        description: "Short lessons for everyday choices and civic action.",
        accent: "var(--ve-green)",
        softAccent: "var(--ve-green-soft)",
        glowRgb: "var(--ve-green-rgb)",
        art: <LessonArt accent="var(--ve-green)" glowRgb="var(--ve-green-rgb)" softAccent="var(--ve-green-soft)" />,
        artClassName: "max-w-[300px]",
        contentClassName: "mt-10",
      },
      {
        id: "earn",
        anchor: "Earn",
        title: "XP as you progress",
        description: "Finish a lesson, answer a quick quiz, and build momentum.",
        accent: "var(--ve-sky)",
        softAccent: "var(--ve-sky-soft)",
        glowRgb: "var(--ve-sky-rgb)",
        art: <QuizArt accent="var(--ve-sky)" glowRgb="var(--ve-sky-rgb)" softAccent="var(--ve-sky-soft)" />,
        artClassName: "max-w-[330px]",
        contentClassName: "mt-12",
      },
      {
        id: "rewards",
        anchor: "Unlock",
        title: "Rewards and missions",
        description: "Use XP, unlock rewards, and open up more missions as you go.",
        accent: "var(--ve-violet)",
        softAccent: "var(--ve-violet-soft)",
        glowRgb: "var(--ve-violet-rgb)",
        art: <RewardsArt accent="var(--ve-violet)" glowRgb="var(--ve-violet-rgb)" softAccent="var(--ve-violet-soft)" />,
        artClassName: "max-w-[330px]",
        contentClassName: "mt-12",
      },
    ],
    [],
  );

  useEffect(() => {
    try {
      const hasSeenWelcome = window.localStorage.getItem(WELCOME_SEEN_STORAGE_KEY) === "true";
      if (hasSeenWelcome) {
        router.replace(destinationHref);
        return;
      }
    } catch {
      // Ignore storage access issues and continue to show onboarding.
    }

    setReady(true);
  }, [destinationHref, router]);

  function markSeenAndContinue() {
    try {
      window.localStorage.setItem(WELCOME_SEEN_STORAGE_KEY, "true");
    } catch {
      // Ignore storage access issues and continue navigation.
    }

    router.push(destinationHref);
  }

  function advance() {
    if (activeIndex >= slides.length - 1) {
      markSeenAndContinue();
      return;
    }

    setActiveIndex((current) => Math.min(current + 1, slides.length - 1));
  }

  const slide = slides[activeIndex];

  if (!ready) {
    return <main className="mobile-shell min-h-[100dvh] bg-[var(--ve-shell)]" />;
  }

  return (
    <main className="mobile-shell relative min-h-[100dvh] overflow-hidden bg-[var(--ve-shell)] px-8 py-10">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[42vh] opacity-90"
        style={{
          background: `radial-gradient(circle at 50% 18%, ${slide.softAccent} 0%, transparent 58%)`,
        }}
      />

      <div className="relative z-10 flex min-h-[100dvh] flex-col">
        <div className="flex justify-end">
          <Button
            className="h-11 px-5 text-base font-black shadow-[0_16px_32px_rgba(16,16,16,0.06)]"
            onClick={markSeenAndContinue}
            variant="soft"
          >
            Skip
          </Button>
        </div>

        <section className="flex flex-1 flex-col justify-center pt-3 text-center">
          <div className={cn("mx-auto w-full max-w-[340px]", slide.artClassName)}>
            {slide.art}
          </div>

          <div className={cn("mx-auto max-w-[320px]", slide.contentClassName)}>
            <p
              className="text-[0.9rem] font-black uppercase tracking-[0.18em]"
              style={{ color: slide.accent }}
            >
              {slide.anchor}
            </p>
            <h2 className="mt-4 text-[2.25rem] font-semibold leading-[1.02] tracking-[-0.05em] text-[var(--foreground)]">
              {slide.title}
            </h2>
            <p className="mt-4 text-[1rem] font-medium leading-7 tracking-[-0.01em] text-[var(--ve-muted)]">
              {slide.description}
            </p>
          </div>

          <div className="mt-16 flex justify-center gap-2.5">
            {slides.map((item, index) => (
              <button
                aria-label={`Go to screen ${index + 1}`}
                className={cn(
                  "rounded-full transition-all",
                  index === activeIndex ? "h-3 w-9" : "h-3 w-3",
                )}
                key={item.id}
                onClick={() => setActiveIndex(index)}
                style={{
                  backgroundColor: index === activeIndex ? slide.accent : "var(--ve-muted-soft)",
                }}
                type="button"
              />
            ))}
          </div>
        </section>

        <div className="relative z-10 pt-6 pb-4">
          <Button
            className="h-16 w-full text-[1.4rem] font-black"
            onClick={advance}
            style={{
              backgroundColor: slide.accent,
              boxShadow: `0 22px 40px rgba(${slide.glowRgb},0.20)`,
            }}
          >
            {activeIndex === slides.length - 1 ? "Get started" : "Next"}
          </Button>
          <div className="mx-auto mt-7 h-1.5 w-[108px] rounded-full bg-[var(--ve-line)]" />
        </div>
      </div>
    </main>
  );
}
