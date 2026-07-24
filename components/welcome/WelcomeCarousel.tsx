"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import styles from "./WelcomeCarousel.module.css";

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
  accentText: string;
  action: string;
  label: string;
  softAccent: string;
  glowRgb: string;
  art: ReactNode;
};

function LessonArt({
  accent,
  accentText,
  softAccent,
  glowRgb,
}: Pick<WelcomeSlide, "accent" | "accentText" | "softAccent" | "glowRgb">) {
  return (
    <div className={cn(styles.artCanvas, "relative h-[320px] w-[320px]")}>
      <div
        className="absolute inset-[10%] rounded-[34%] blur-[1px]"
        style={{ background: `radial-gradient(circle at 50% 42%, ${softAccent} 0%, transparent 72%)` }}
      />
      <div
        className="absolute left-[13%] top-[16%] h-[72%] w-[72%] rounded-[30%]"
        style={{ backgroundColor: softAccent, boxShadow: `0 32px 72px rgba(${glowRgb},0.12)` }}
      />
      <div
        className={cn(
          styles.artCard,
          "absolute left-[24%] top-[28%] h-[46%] w-[46%] rounded-[24px] p-5",
        )}
      >
        <div className="flex items-center gap-3">
          <div
            className="grid h-11 w-11 shrink-0 place-items-center rounded-[16px] text-lg font-black"
            style={{ backgroundColor: accent, color: accentText }}
          >
            1
          </div>
          <div className="min-w-0 flex-1">
            <div className="h-2.5 w-14 rounded-full bg-[var(--ve-intro-panel)]" />
            <div className="mt-2 h-2.5 w-20 rounded-full bg-[var(--ve-intro-panel)]" />
          </div>
        </div>
        <div className="mt-5 space-y-3">
          <div className="h-11 rounded-[16px] border border-[var(--ve-intro-line)] bg-[var(--ve-intro-control)]" />
          <div className="h-11 rounded-[16px] border border-[var(--ve-intro-line)] bg-[var(--ve-intro-control)]" />
          <div
            className="flex h-11 items-center justify-between rounded-[16px] border px-4"
            style={{
              borderColor: accent,
              backgroundColor: `color-mix(in srgb, ${accent} 10%, var(--ve-intro-control))`,
            }}
          >
            <div className="h-2.5 w-20 rounded-full bg-[var(--ve-intro-card)]" />
            <div
              className="grid h-6 w-6 place-items-center rounded-full text-[0.8rem] font-black"
              style={{ backgroundColor: accent, color: accentText }}
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

function QuizArt({
  accent,
  accentText,
  softAccent,
  glowRgb,
}: Pick<WelcomeSlide, "accent" | "accentText" | "softAccent" | "glowRgb">) {
  return (
    <div className={cn(styles.artCanvas, "relative h-[320px] w-[320px]")}>
      <div
        className="absolute inset-[12%] rounded-[32%]"
        style={{ backgroundColor: softAccent, boxShadow: `0 32px 72px rgba(${glowRgb},0.12)` }}
      />
      <div className={cn(styles.artCard, "absolute left-[16%] top-[21%] rounded-[24px] px-5 py-4")}>
        <div className="flex gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: accent }} />
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--ve-store)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--ve-intro-line)]" />
        </div>
        <div className="mt-4 space-y-3">
          <div className="h-3 w-28 rounded-full bg-[var(--ve-intro-panel)]" />
          <div className="grid gap-2">
            <div className="h-10 rounded-[16px] border border-[var(--ve-intro-line)] bg-[var(--ve-intro-control)]" />
            <div
              className="h-10 rounded-[16px] border"
              style={{
                borderColor: accent,
                backgroundColor: `color-mix(in srgb, ${accent} 12%, var(--ve-intro-control))`,
              }}
            />
            <div className="h-10 rounded-[16px] border border-[var(--ve-intro-line)] bg-[var(--ve-intro-control)]" />
          </div>
        </div>
      </div>
      <div
        className="absolute right-[13%] top-[24%] grid h-[18%] w-[18%] place-items-center rounded-[30%] text-[1.45rem] font-black"
        style={{
          backgroundColor: accent,
          boxShadow: `0 14px 28px rgba(${glowRgb},0.22)`,
          color: accentText,
        }}
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

function RewardsArt({
  accent,
  accentText,
  label,
  softAccent,
  glowRgb,
}: Pick<WelcomeSlide, "accent" | "accentText" | "label" | "softAccent" | "glowRgb">) {
  return (
    <div className={cn(styles.artCanvas, "relative h-[320px] w-[320px]")}>
      <div
        className="absolute inset-[14%] rounded-[32%]"
        style={{ backgroundColor: softAccent, boxShadow: `0 32px 72px rgba(${glowRgb},0.14)` }}
      />
      <div
        className={cn(
          styles.artCard,
          "absolute left-[14%] top-[24%] h-[44%] w-[34%] rounded-[26px] p-4",
        )}
      >
        <div
          className="rounded-[18px] px-3 py-2 text-center text-xs font-black uppercase tracking-[0.14em]"
          style={{ backgroundColor: softAccent, color: label }}
        >
          Mission
        </div>
        <div className="mt-4 h-3 w-14 rounded-full bg-[var(--ve-intro-panel)]" />
        <div className="mt-3 h-3 w-20 rounded-full bg-[var(--ve-intro-panel)]" />
        <div className="mt-5 h-2 rounded-full bg-[var(--ve-intro-panel)]">
          <div className="h-full w-[68%] rounded-full" style={{ backgroundColor: accent }} />
        </div>
      </div>
      <div
        className={cn(
          styles.artCard,
          "absolute right-[14%] top-[20%] h-[48%] w-[28%] rounded-[24px] px-4 py-5",
        )}
      >
        <div className="text-center text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted-strong)]">
          Reward
        </div>
        <div className="mt-4 text-center text-[2rem] font-black" style={{ color: accent }}>
          2x
        </div>
        <div className="mt-2 text-center text-xs font-semibold text-[var(--ve-muted-strong)]">XP Boost</div>
        <div
          className="mt-5 rounded-[16px] px-3 py-2 text-center text-xs font-black"
          style={{ backgroundColor: accent, color: accentText }}
        >
          Active
        </div>
      </div>
      <div
        className="absolute bottom-[15%] left-[28%] rounded-full px-4 py-2 text-sm font-black"
        style={{
          backgroundColor: accent,
          boxShadow: `0 18px 36px rgba(${glowRgb},0.24)`,
          color: accentText,
        }}
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
        accentText: "var(--ve-green-on-accent)",
        action: "var(--ve-green-action)",
        label: "var(--ve-green-label)",
        softAccent: "var(--ve-green-soft)",
        glowRgb: "var(--ve-green-rgb)",
        art: (
          <LessonArt
            accent="var(--ve-green)"
            accentText="var(--ve-green-on-accent)"
            glowRgb="var(--ve-green-rgb)"
            softAccent="var(--ve-green-soft)"
          />
        ),
      },
      {
        id: "earn",
        anchor: "Earn",
        title: "XP as you progress",
        description: "Finish a lesson, answer a quick quiz, and build momentum.",
        accent: "var(--ve-sky)",
        accentText: "var(--ve-sky-on-accent)",
        action: "var(--ve-sky-action)",
        label: "var(--ve-sky-label)",
        softAccent: "var(--ve-sky-soft)",
        glowRgb: "var(--ve-sky-rgb)",
        art: (
          <QuizArt
            accent="var(--ve-sky)"
            accentText="var(--ve-sky-on-accent)"
            glowRgb="var(--ve-sky-rgb)"
            softAccent="var(--ve-sky-soft)"
          />
        ),
      },
      {
        id: "rewards",
        anchor: "Unlock",
        title: "Rewards and missions",
        description: "Use XP, unlock rewards, and open up more missions as you go.",
        accent: "var(--ve-violet)",
        accentText: "var(--ve-violet-on-accent)",
        action: "var(--ve-violet-action)",
        label: "var(--ve-violet-label)",
        softAccent: "var(--ve-violet-soft)",
        glowRgb: "var(--ve-violet-rgb)",
        art: (
          <RewardsArt
            accent="var(--ve-violet)"
            accentText="var(--ve-violet-on-accent)"
            glowRgb="var(--ve-violet-rgb)"
            label="var(--ve-violet-label)"
            softAccent="var(--ve-violet-soft)"
          />
        ),
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
    <main className={cn("mobile-shell bg-[var(--ve-shell)]", styles.screen)}>
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[38%] opacity-90"
        style={{
          background: `radial-gradient(circle at 50% 18%, ${slide.softAccent} 0%, transparent 58%)`,
        }}
      />

      <div className={styles.layout}>
        <div className={styles.header}>
          <Button
            className={styles.skipButton}
            onClick={markSeenAndContinue}
            variant="soft"
          >
            Skip
          </Button>
        </div>

        <section className={styles.content}>
          <div className={styles.artStage}>
            {slide.art}
          </div>

          <div className={styles.copy}>
            <p
              className={styles.anchor}
              style={{ color: slide.label }}
            >
              {slide.anchor}
            </p>
            <h2 className={styles.title}>
              {slide.title}
            </h2>
            <p className={styles.description}>
              {slide.description}
            </p>
          </div>

          <div className={styles.dots}>
            {slides.map((item, index) => (
              <button
                aria-label={`Go to screen ${index + 1}`}
                className={cn(
                  "rounded-full transition-all",
                  index === activeIndex ? "h-2.5 w-8" : "h-2.5 w-2.5",
                )}
                key={item.id}
                onClick={() => setActiveIndex(index)}
                style={{
                  backgroundColor: index === activeIndex ? slide.label : "var(--ve-intro-dot)",
                }}
                type="button"
              />
            ))}
          </div>
        </section>

        <div className={styles.footer}>
          <Button
            className={styles.actionButton}
            onClick={advance}
            style={{
              backgroundColor: slide.action,
              boxShadow: `0 22px 40px rgba(${slide.glowRgb},0.20)`,
            }}
          >
            {activeIndex === slides.length - 1 ? "Get started" : "Next"}
          </Button>
        </div>
      </div>
    </main>
  );
}
