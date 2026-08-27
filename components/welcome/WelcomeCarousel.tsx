"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ChevronRightIcon } from "@/components/ui/Icons";
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
  imageSrc: string;
  imageAlt: string;
};

export function WelcomeCarousel({ destinationHref }: WelcomeCarouselProps) {
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(0);
  const [ready, setReady] = useState(false);

  const slides = useMemo<WelcomeSlide[]>(
    () => [
      {
        id: "learn",
        anchor: "Learn",
        title: "Practical, values-based lessons",
        description:
          "Short, useful lessons designed to help you make informed choices and take meaningful action.",
        accent: "var(--ve-green)",
        accentText: "var(--ve-green-on-accent)",
        action: "var(--ve-green-action)",
        label: "var(--ve-green-label)",
        softAccent: "var(--ve-green-soft)",
        glowRgb: "var(--ve-green-rgb)",
        imageSrc: "/images/welcome-carousel-learn.jpg",
        imageAlt: "A learner working through a short, practical values-based lesson.",
      },
      {
        id: "earn",
        anchor: "Earn",
        title: "XP as you progress",
        description:
          "Complete lessons and quick quizzes to earn XP. Track your journey and watch your knowledge grow over time.",
        accent: "var(--ve-sky)",
        accentText: "var(--ve-sky-on-accent)",
        action: "var(--ve-sky-action)",
        label: "var(--ve-sky-label)",
        softAccent: "var(--ve-sky-soft)",
        glowRgb: "var(--ve-sky-rgb)",
        imageSrc: "/images/welcome-carousel-earn.jpg",
        imageAlt: "An abstract badge illustration representing XP earned by progressing through lessons.",
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
        imageSrc: "/images/welcome-carousel-unlock.jpg",
        imageAlt: "A warm editorial illustration representing redeeming rewards and unlocking new missions.",
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
  const isLastSlide = activeIndex === slides.length - 1;

  if (!ready) {
    return <main className="min-h-screen w-full bg-[var(--ve-shell)]" />;
  }

  const dots = slides.map((item, index) => (
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
  ));

  return (
    <main className="min-h-screen w-full overflow-hidden bg-[var(--ve-shell)] lg:bg-[var(--background)]">
      {/* Mobile / tablet: fixed-height, no-scroll compact carousel */}
      <div className={cn("relative mx-auto w-full max-w-[430px] bg-[var(--ve-shell)] shadow-[0_20px_60px_rgba(var(--ve-shadow-rgb),0.16)] lg:!hidden", styles.screen)}>
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
              variant="ghost"
            >
              Skip
            </Button>
          </div>

          <section className={styles.content}>
            <div className={styles.artStage}>
              <Image
                alt={slide.imageAlt}
                className={styles.artImage}
                fill
                priority={activeIndex === 0}
                sizes="272px"
                src={slide.imageSrc}
              />
            </div>

            <div className={styles.copy}>
              <p className={styles.anchor} style={{ color: slide.label }}>
                {slide.anchor}
              </p>
              <h2 className={styles.title}>{slide.title}</h2>
              <p className={styles.description}>{slide.description}</p>
            </div>

            <div className={styles.dots}>{dots}</div>
          </section>

          <div className={styles.footer}>
            <Button
              className={cn(styles.actionButton, "gap-2")}
              onClick={advance}
              style={{
                backgroundColor: slide.action,
                boxShadow: `0 22px 40px rgba(${slide.glowRgb},0.20)`,
              }}
            >
              {isLastSlide ? "Get started" : "Next"}
              <ChevronRightIcon className="size-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Desktop: full split-screen layout */}
      <div className="hidden min-h-screen lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(440px,560px)]">
        <section className="relative overflow-hidden">
          <Image
            alt={slide.imageAlt}
            className="object-cover"
            fill
            priority
            sizes="(min-width: 1024px) 60vw, 0px"
            src={slide.imageSrc}
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: `linear-gradient(180deg, transparent 55%, color-mix(in srgb, ${slide.accent} 32%, black 10%) 100%)`,
            }}
          />
          <p
            className="absolute bottom-10 left-12 text-[clamp(2.5rem,4vw,3.75rem)] font-black leading-none tracking-[-0.04em] text-white"
          >
            {slide.anchor}
          </p>
        </section>

        <section className="flex min-h-screen flex-col justify-between bg-[var(--ve-card)] px-14 py-10 shadow-[-28px_0_80px_rgba(var(--ve-shadow-rgb),0.08)]">
          <div className="flex justify-end">
            <Button className={styles.skipButton} onClick={markSeenAndContinue} variant="ghost">
              Skip
            </Button>
          </div>

          <div className="max-w-md">
            <p className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: slide.label }}>
              {slide.anchor}
            </p>
            <h2 className="mt-4 text-4xl font-black leading-[1.1] tracking-[-0.03em] text-[var(--foreground)]">
              {slide.title}
            </h2>
            <p className="mt-5 text-lg font-semibold leading-8 text-[var(--ve-muted-strong)]">
              {slide.description}
            </p>
            <div className="mt-8 flex gap-2.5">{dots}</div>
          </div>

          <Button
            className="h-14 w-full gap-2 text-lg font-black"
            onClick={advance}
            style={{
              backgroundColor: slide.action,
              boxShadow: `0 22px 40px rgba(${slide.glowRgb},0.20)`,
            }}
          >
            {isLastSlide ? "Get started" : "Next"}
            <ChevronRightIcon className="size-5" />
          </Button>
        </section>
      </div>
    </main>
  );
}
