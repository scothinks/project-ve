"use client";

import Link from "next/link";
import { useState } from "react";
import type { Lesson } from "@/lib/lessons";

type LessonMenuProps = {
  lesson: Lesson;
  courseHref: string;
  currentPageNumber: number;
};

type MessageTone = "success" | "warning";

function MenuIcon() {
  return (
    <span className="flex flex-col gap-1">
      <span className="h-0.5 w-4 rounded bg-[var(--foreground)]" />
      <span className="h-0.5 w-3 rounded bg-[var(--foreground)]" />
      <span className="h-0.5 w-4 rounded bg-[var(--foreground)]" />
    </span>
  );
}

function CloseIcon() {
  return (
    <span className="relative block size-4">
      <span className="absolute left-0 top-1/2 h-0.5 w-4 -translate-y-1/2 rotate-45 rounded bg-[var(--foreground)]" />
      <span className="absolute left-0 top-1/2 h-0.5 w-4 -translate-y-1/2 -rotate-45 rounded bg-[var(--foreground)]" />
    </span>
  );
}

export function LessonMenu({ lesson, courseHref, currentPageNumber }: LessonMenuProps) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: MessageTone } | null>(null);

  function closeMenu() {
    setOpen(false);
    setMessage(null);
  }

  function saveOffline() {
    try {
      window.localStorage.setItem(
        `project-ve:offline-lesson:${lesson.id}`,
        JSON.stringify({
          savedAt: new Date().toISOString(),
          currentPageNumber,
          lesson,
        }),
      );
      setMessage({ text: "Lesson saved on this device.", tone: "success" });
    } catch {
      setMessage({
        text: "Could not save this lesson on this device.",
        tone: "warning",
      });
    }
  }

  async function shareLesson() {
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({
          title: lesson.title,
          text: lesson.summary,
          url,
        });
        setMessage({ text: "Lesson shared.", tone: "success" });
        return;
      } catch {
        return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setMessage({ text: "Lesson link copied.", tone: "success" });
    } catch {
      setMessage({ text: "Copy failed. Select the address bar to copy.", tone: "warning" });
    }
  }

  return (
    <>
      <button
        aria-expanded={open}
        aria-label="Open lesson menu"
        className="grid size-8 place-items-center"
        onClick={() => setOpen(true)}
        type="button"
      >
        <MenuIcon />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 bg-black/30 px-4 py-5" role="presentation">
          <button
            aria-label="Close lesson menu"
            className="absolute inset-0 size-full cursor-default"
            onClick={closeMenu}
            type="button"
          />
          <aside
            aria-label="Lesson menu"
            className="absolute right-4 top-5 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-[24px] bg-[var(--ve-card)] shadow-[0_24px_60px_rgba(0,0,0,0.18)]"
          >
            <div className="flex items-start justify-between gap-4 border-b border-[var(--ve-line-soft)] p-5">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#008751]">
                  Lesson Menu
                </p>
                <h2 className="mt-1 truncate text-lg font-black">{lesson.title}</h2>
              </div>
              <button
                aria-label="Close menu"
                className="grid size-8 shrink-0 place-items-center rounded-full bg-[#f3f3f3]"
                onClick={closeMenu}
                type="button"
              >
                <CloseIcon />
              </button>
            </div>

            {message ? (
              <div
                className={`mx-5 mt-4 rounded-[16px] px-4 py-3 text-xs font-bold ${
                  message.tone === "success"
                    ? "bg-[#f0fbf6] text-[#008751]"
                    : "bg-[#fff0e8] text-[#c94f2e]"
                }`}
              >
                {message.text}
              </div>
            ) : null}

            <div className="space-y-2 p-5">
              <Link
                className="block rounded-[18px] bg-[var(--ve-card-muted)] px-4 py-3 text-sm font-black"
                href={courseHref}
                onClick={closeMenu}
              >
                Back to course
                <span className="mt-1 block text-xs font-semibold text-[var(--ve-muted)]">
                  Your reading progress stays saved.
                </span>
              </Link>
              <Link
                className="block rounded-[18px] bg-[var(--ve-card-muted)] px-4 py-3 text-sm font-black"
                href="/dashboard"
                onClick={closeMenu}
              >
                Dashboard
                <span className="mt-1 block text-xs font-semibold text-[var(--ve-muted)]">
                  Return to your home screen.
                </span>
              </Link>
              <button
                className="w-full rounded-[18px] bg-[var(--ve-card-muted)] px-4 py-3 text-left text-sm font-black"
                onClick={saveOffline}
                type="button"
              >
                Read Offline
                <span className="mt-1 block text-xs font-semibold text-[var(--ve-muted)]">
                  Save this lesson on this device.
                </span>
              </button>
              <button
                className="w-full rounded-[18px] bg-[var(--ve-card-muted)] px-4 py-3 text-left text-sm font-black"
                onClick={() => void shareLesson()}
                type="button"
              >
                Share
                <span className="mt-1 block text-xs font-semibold text-[var(--ve-muted)]">
                  Send this lesson link.
                </span>
              </button>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
