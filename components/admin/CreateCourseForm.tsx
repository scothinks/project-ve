"use client";

import Image from "@/components/media/MediaImage";
import Link from "next/link";
import { useState } from "react";
import { saveCourse } from "@/app/admin/courses/actions";
import { CourseAudienceField } from "@/components/admin/CourseAudienceField";
import { CourseOutcomesField } from "@/components/admin/CourseOutcomesField";
import { useMediaPicker } from "@/components/admin/MediaPickerProvider";
import type { AdminLearningMediaAssetRow } from "@/lib/admin";
import { getImageFitClass, getImagePresentationStyle } from "@/lib/image-presentation";
import { cn } from "@/lib/utils";

const TITLE_MAX_LENGTH = 60;
const CATEGORY_PRESETS = ["Civic Education", "Civic Participation", "Values Education", "Civic Responsibility"];
const LEVELS: Array<{ key: string; label: string }> = [
  { key: "beginner", label: "Beginner" },
  { key: "intermediate", label: "Intermediate" },
  { key: "advanced", label: "Advanced" },
];

function pillClasses(active: boolean) {
  return cn(
    "inline-flex items-center justify-center rounded-full border px-[18px] py-[9px] text-[13px]",
    active
      ? "border-[var(--admin-primary)] bg-[var(--admin-primary)] font-extrabold text-[var(--admin-on-primary)]"
      : "border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] font-bold text-[var(--admin-on-surface)]",
  );
}

export function CreateCourseForm({
  aiGenerationAvailable,
  categories,
  mediaLibraryAssets,
  nextSortOrder,
}: {
  aiGenerationAvailable: boolean;
  categories: string[];
  mediaLibraryAssets: AdminLearningMediaAssetRow[];
  nextSortOrder: number;
}) {
  const { requestMedia } = useMediaPicker();
  const categoryOptions = Array.from(new Set([...CATEGORY_PRESETS, ...categories]));
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(categoryOptions[0] ?? "Values Education");
  const [customCategory, setCustomCategory] = useState("");
  const [showCustomCategory, setShowCustomCategory] = useState(false);
  const [level, setLevel] = useState("beginner");
  const [detailOpen, setDetailOpen] = useState(false);
  const [cover, setCover] = useState({ altText: "", fit: "cover", positionX: 50, positionY: 50, url: "" });

  async function pickCover() {
    const picked = await requestMedia({
      aiGenerationAvailable,
      assetTypeFilter: ["cover", "image", "thumbnail"],
      initialAltText: cover.altText,
      initialFit: cover.fit,
      initialPositionX: cover.positionX,
      initialPositionY: cover.positionY,
      initialUrl: cover.url,
      libraryAssets: mediaLibraryAssets,
      placementLabel: "Course cover",
      title: "Choose a cover image",
    });

    if (picked) setCover(picked);
  }

  const remaining = TITLE_MAX_LENGTH - title.length;
  const titleCountClass = remaining <= 0
    ? "text-[var(--admin-secondary)]"
    : remaining <= 10
      ? "text-[var(--admin-tertiary)]"
      : "text-[var(--admin-outline)]";

  return (
    <form action={saveCourse}>
      <input name="sortOrder" type="hidden" value={nextSortOrder} />
      <input name="estimatedMinutes" type="hidden" value={0} />
      <input name="status" type="hidden" value="draft" />
      <input name="category" type="hidden" value={category} />
      <input name="categoryCustom" type="hidden" value={showCustomCategory ? customCategory : ""} />

      <div className="-mx-5 -mt-6 flex items-center justify-between gap-3 border-b border-[var(--admin-border-warm)] px-5 py-6 md:-mx-8 md:-mt-8 md:px-16">
        <Link
          className="inline-flex items-center gap-2 text-sm font-bold text-[var(--admin-on-surface-variant)]"
          href="/admin/courses/choose"
        >
          ← Back
        </Link>
        <button
          className="rounded-full bg-[var(--admin-primary)] px-7 py-[13px] text-sm font-extrabold text-[var(--admin-on-primary)] shadow-[0_6px_18px_rgba(18,60,53,0.14)]"
          type="submit"
        >
          Create course
        </button>
      </div>

      <div className="flex justify-center px-6 py-12 md:py-24">
        <div className="flex w-full max-w-[680px] flex-col gap-9">
          <div>
            <input name="thumbnailUrl" type="hidden" value={cover.url} />
            <input name="thumbnailAlt" type="hidden" value={cover.altText} />
            <input name="imageFit" type="hidden" value={cover.fit} />
            <input name="imagePositionX" type="hidden" value={cover.positionX} />
            <input name="imagePositionY" type="hidden" value={cover.positionY} />
            <button
              className="relative block h-[220px] w-full overflow-hidden rounded-[20px] text-left"
              onClick={() => {
                void pickCover();
              }}
              type="button"
            >
              {cover.url ? (
                <>
                  <Image
                    alt={cover.altText}
                    className={getImageFitClass(cover)}
                    fill
                    sizes="680px"
                    src={cover.url}
                    style={getImagePresentationStyle(cover)}
                  />
                  <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/55 to-transparent p-4">
                    <span className="text-[13px] font-bold text-white/90">Cover image &middot; click to change</span>
                  </div>
                </>
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2.5 rounded-[20px] border-[1.5px] border-dashed border-[var(--admin-border-warm)] bg-[var(--admin-surface-container-low)] text-[var(--admin-outline)]">
                  <svg aria-hidden="true" className="h-[30px] w-[30px]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
                    <rect height="14" rx="2" width="18" x="3" y="5" />
                    <circle cx="9" cy="10" r="1.5" />
                    <path d="m21 16-5-4-4 3-3-2-6 5" />
                  </svg>
                  <span className="text-[13px] font-bold">Add a cover image</span>
                  <span className="text-xs font-medium">This is the first thing learners see</span>
                </div>
              )}
            </button>
          </div>

          <label className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--admin-on-surface-variant)]">
                Course title
              </span>
              <span className={cn("text-[11px] font-extrabold", titleCountClass)}>
                {title.length}/{TITLE_MAX_LENGTH}
              </span>
            </div>
            <input
              className="border-0 border-b-2 border-[var(--admin-border-warm)] bg-transparent px-0.5 pb-3.5 pt-1.5 text-[34px] font-black tracking-[-0.01em] text-[var(--admin-brand-hero)] outline-none focus:border-[var(--admin-primary)]"
              maxLength={TITLE_MAX_LENGTH}
              name="title"
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Give your course a name"
              required
              value={title}
            />
            <span className="text-xs font-semibold text-[var(--admin-on-surface-variant)]">
              Short titles read best on course cards — aim for 2 to 6 words.
            </span>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--admin-on-surface-variant)]">
              What&apos;s it about?
            </span>
            <textarea
              className="min-h-[76px] resize-none rounded-[14px] border border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] px-4 py-3.5 text-[15px] font-medium leading-[1.5] text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)]"
              name="description"
              placeholder="One or two sentences a learner would read before enrolling."
              required
            />
          </label>

          <div className="flex flex-col gap-3">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--admin-on-surface-variant)]">
              Category
            </span>
            <div className="flex flex-wrap gap-2">
              {categoryOptions.map((option) => (
                <button
                  className={pillClasses(!showCustomCategory && category === option)}
                  key={option}
                  onClick={() => {
                    setCategory(option);
                    setShowCustomCategory(false);
                  }}
                  type="button"
                >
                  {option}
                </button>
              ))}
              <button
                className={pillClasses(showCustomCategory)}
                onClick={() => setShowCustomCategory(true)}
                type="button"
              >
                + Custom
              </button>
            </div>
            {showCustomCategory ? (
              <input
                className="min-h-11 w-full max-w-xs rounded-[14px] border border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] px-4 text-sm font-bold text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)]"
                onChange={(event) => setCustomCategory(event.target.value)}
                placeholder="Type the new category name"
                value={customCategory}
              />
            ) : null}
          </div>

          <div className="flex flex-col gap-3">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--admin-on-surface-variant)]">
              Difficulty
            </span>
            <div className="flex gap-2">
              {LEVELS.map((option) => (
                <button
                  className={pillClasses(level === option.key)}
                  key={option.key}
                  onClick={() => setLevel(option.key)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
            <input name="level" type="hidden" value={level} />
          </div>

          <button
            className="inline-flex items-center gap-2 self-start py-1 text-[13px] font-extrabold text-[var(--admin-primary)]"
            onClick={() => setDetailOpen((current) => !current)}
            type="button"
          >
            <span
              className="inline-flex transition-transform"
              style={{ transform: detailOpen ? "rotate(90deg)" : "rotate(0deg)" }}
            >
              <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.6" viewBox="0 0 24 24">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </span>
            {detailOpen ? "Hide audience & outcomes" : "Add audience & outcomes"}
          </button>

          <div className={cn("flex-col gap-6 rounded-[18px] bg-[var(--admin-surface-container-low)] p-6", detailOpen ? "flex" : "hidden")}>
            <CourseAudienceField defaultValue="" />
            <CourseOutcomesField defaultValue={[]} />
          </div>
        </div>
      </div>
    </form>
  );
}
