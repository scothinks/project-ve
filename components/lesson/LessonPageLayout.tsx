import Image from "next/image";
import { LessonContent } from "@/components/lesson/LessonContent";
import { getImageFitClass, getImagePresentationStyle } from "@/lib/image-presentation";
import type { ImageAsset, LessonContentBlock, LessonPageType } from "@/lib/lessons";

type LessonPageLayoutProps = {
  blocks: LessonContentBlock[];
  coverImage?: ImageAsset | null;
  isPreview?: boolean;
  pageType: LessonPageType | string;
  subtitle?: string | null;
  title: string;
};

const pageTypeConfig: Record<
  LessonPageType,
  {
    label: string;
    intro: string;
    shell: string;
    badge: string;
    title: string;
    subtitle: string;
    image: string;
    content: string;
  }
> = {
  primer: {
    label: "Primer",
    intro: "Start here",
    shell: "bg-[var(--ve-card)]",
    badge: "bg-[var(--ve-green-soft)] text-[var(--ve-green)]",
    title: "text-center text-[24px] font-black leading-8",
    subtitle:
      "mx-auto mt-2.5 max-w-[18rem] text-center text-[15px] font-semibold leading-6 text-[color:color-mix(in_srgb,var(--ve-muted-strong)_88%,var(--foreground))]",
    image: "mb-5 aspect-[31/18] w-full rounded-[20px] object-cover",
    content: "mt-6",
  },
  concept: {
    label: "Concept",
    intro: "Learn the idea",
    shell: "bg-[var(--ve-card)]",
    badge: "bg-[color:color-mix(in_srgb,var(--ve-sky)_18%,var(--ve-card))] text-[color:color-mix(in_srgb,var(--ve-sky)_75%,var(--foreground))]",
    title: "text-left text-[22px] font-black leading-7",
    subtitle:
      "mt-2.5 text-[15px] font-semibold leading-6 text-[color:color-mix(in_srgb,var(--ve-muted-strong)_90%,var(--foreground))]",
    image: "mb-5 aspect-[31/18] w-full rounded-[18px] object-cover",
    content: "mt-6",
  },
  example: {
    label: "Example",
    intro: "See it happen",
    shell: "rounded-[22px] border border-[color:color-mix(in_srgb,var(--ve-mission)_24%,var(--ve-line-soft))] bg-[color:color-mix(in_srgb,var(--ve-mission-soft)_76%,var(--ve-card))] p-5",
    badge: "bg-[color:color-mix(in_srgb,var(--ve-mission)_14%,var(--ve-card))] text-[#c94f2e]",
    title: "text-left text-[23px] font-black leading-8",
    subtitle:
      "mt-2.5 text-[15px] font-semibold leading-6 text-[color:color-mix(in_srgb,var(--ve-muted-strong)_90%,var(--foreground))]",
    image: "mt-4 h-34 w-full rounded-[18px] object-cover lg:h-52",
    content:
      "mt-6 rounded-[20px] border border-[color:color-mix(in_srgb,var(--ve-mission)_12%,var(--ve-line-soft))] bg-[var(--ve-card)] p-5",
  },
  reflection: {
    label: "Reflection",
    intro: "Think it through",
    shell: "rounded-[24px] border border-[color:color-mix(in_srgb,#6750a4_18%,var(--ve-line-soft))] bg-[color:color-mix(in_srgb,#6750a4_10%,var(--ve-card))] p-5 lg:p-6",
    badge: "bg-[var(--ve-card)] text-[#7f6ac0]",
    title: "text-center text-[23px] font-black leading-8",
    subtitle:
      "mx-auto mt-3 max-w-[19rem] text-center text-[15px] font-semibold leading-6 text-[color:color-mix(in_srgb,var(--ve-muted-strong)_86%,var(--foreground))]",
    image: "mt-5 h-32 w-full rounded-[18px] object-cover lg:h-48",
    content:
      "mt-6 rounded-[20px] bg-[color:color-mix(in_srgb,var(--ve-card)_88%,white)] p-5",
  },
  summary: {
    label: "Summary",
    intro: "Wrap up",
    shell: "rounded-[24px] border border-[color:color-mix(in_srgb,var(--ve-green)_20%,var(--ve-line-soft))] bg-[color:color-mix(in_srgb,var(--ve-green-soft)_68%,var(--ve-card))] p-5 lg:p-6",
    badge: "bg-[#087f5b] text-white",
    title: "text-left text-[23px] font-black leading-8",
    subtitle:
      "mt-2.5 text-[15px] font-semibold leading-6 text-[color:color-mix(in_srgb,var(--ve-muted-strong)_90%,var(--foreground))]",
    image: "mt-5 h-32 w-full rounded-[18px] object-cover lg:h-48",
    content:
      "mt-6 rounded-[20px] border border-[color:color-mix(in_srgb,var(--ve-green)_10%,var(--ve-line-soft))] bg-[var(--ve-card)] p-5",
  },
};

function getPageTypeConfig(pageType: LessonPageType | string) {
  if (pageType in pageTypeConfig) {
    return pageTypeConfig[pageType as LessonPageType];
  }

  return pageTypeConfig.concept;
}

export function LessonPageLayout({
  blocks,
  coverImage,
  isPreview = false,
  pageType,
  subtitle,
  title,
}: LessonPageLayoutProps) {
  const config = getPageTypeConfig(pageType);
  const isImageBeforeTitle = pageType === "primer" || pageType === "concept";
  const emptyText = isPreview ? "Add a block to preview this page." : "No content yet.";
  const coverImageSizes = "(min-width: 1024px) 688px, (min-width: 768px) 608px, calc(100vw - 6rem)";

  return (
    <div className={config.shell}>
      <div className={isPreview && config.shell === "bg-[var(--ve-card)]" ? "" : undefined}>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] ${config.badge}`}>
            {config.label}
          </span>
          <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[color:color-mix(in_srgb,var(--ve-muted)_90%,var(--foreground))]">
            {config.intro}
          </span>
        </div>

        {coverImage && isImageBeforeTitle ? (
          <div className={`relative overflow-hidden ${config.image}`}>
            <Image
              alt={coverImage.alt}
              className={getImageFitClass(coverImage)}
              fill
              sizes={coverImageSizes}
              src={coverImage.src}
              style={getImagePresentationStyle(coverImage)}
            />
          </div>
        ) : null}

        <h1 className={config.title}>{title}</h1>
        {subtitle ? <p className={config.subtitle}>{subtitle}</p> : null}

        {coverImage && !isImageBeforeTitle ? (
          <div className={`relative overflow-hidden ${config.image}`}>
            <Image
              alt={coverImage.alt}
              className={getImageFitClass(coverImage)}
              fill
              sizes={coverImageSizes}
              src={coverImage.src}
              style={getImagePresentationStyle(coverImage)}
            />
          </div>
        ) : null}
      </div>

      <div className={config.content}>
        {blocks.length === 0 ? (
          <div className="rounded-[18px] border border-dashed border-[var(--ve-line)] px-4 py-8 text-center text-xs font-bold text-[var(--ve-muted)]">
            {emptyText}
          </div>
        ) : (
          <LessonContent blocks={blocks} variant={pageType} />
        )}
      </div>
    </div>
  );
}
