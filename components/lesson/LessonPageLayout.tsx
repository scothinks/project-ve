import Image from "@/components/media/MediaImage";
import { LessonContent } from "@/components/lesson/LessonContent";
import { Card } from "@/components/ui/Card";
import { getImageFitClass, getImagePresentationStyle } from "@/lib/image-presentation";
import type { ImageAsset, LessonContentBlock, LessonPageType } from "@/lib/lessons";

type LessonPageLayoutProps = {
  blocks: LessonContentBlock[];
  coverImage?: ImageAsset | null;
  isPreview?: boolean;
  pageNumber?: number;
  pageType: LessonPageType | string;
  subtitle?: string | null;
  title: string;
  totalPages?: number;
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
    shell: "bg-[var(--ui-surface)]",
    badge: "bg-[var(--ui-learning-bg)] text-[var(--ui-learning)]",
    title: "text-center text-[24px] font-black leading-8",
    subtitle:
      "mx-auto mt-2.5 max-w-[18rem] text-center text-[15px] font-semibold leading-6 text-[color:color-mix(in_srgb,var(--ui-text-muted)_88%,var(--ui-text))]",
    image: "mb-5 aspect-[31/18] w-full rounded-[20px] object-cover",
    content: "mt-6",
  },
  concept: {
    label: "Concept",
    intro: "Learn the idea",
    shell: "bg-[var(--ui-surface)]",
    badge: "bg-[color:color-mix(in_srgb,var(--ui-learning)_18%,var(--ui-surface))] text-[var(--ui-learning)]",
    title: "text-left text-[22px] font-black leading-7",
    subtitle:
      "mt-2.5 text-[15px] font-semibold leading-6 text-[color:color-mix(in_srgb,var(--ui-text-muted)_90%,var(--ui-text))]",
    image: "mb-5 aspect-[31/18] w-full rounded-[18px] object-cover",
    content: "mt-6",
  },
  example: {
    label: "Example",
    intro: "See it happen",
    shell: "rounded-[22px] border border-[color:color-mix(in_srgb,var(--ui-text)_24%,var(--ui-border-subtle))] bg-[color:color-mix(in_srgb,var(--ui-support-bg)_76%,var(--ui-surface))] p-5",
    badge: "bg-[color:color-mix(in_srgb,var(--ui-text)_14%,var(--ui-surface))] text-[var(--ui-text)]",
    title: "text-left text-[23px] font-black leading-8",
    subtitle:
      "mt-2.5 text-[15px] font-semibold leading-6 text-[color:color-mix(in_srgb,var(--ui-text-muted)_90%,var(--ui-text))]",
    image: "mt-4 h-34 w-full rounded-[18px] object-cover lg:h-52",
    content:
      "mt-6 rounded-[20px] border border-[color:color-mix(in_srgb,var(--ui-text)_12%,var(--ui-border-subtle))] bg-[var(--ui-surface)] p-5",
  },
  reflection: {
    label: "Reflection",
    intro: "Think it through",
    shell: "rounded-[24px] border border-[color:color-mix(in_srgb,var(--ui-learning)_18%,var(--ui-border-subtle))] bg-[color:color-mix(in_srgb,var(--ui-learning)_10%,var(--ui-surface))] p-5 lg:p-6",
    badge: "bg-[var(--ui-surface)] text-[var(--ui-text)]",
    title: "text-center text-[23px] font-black leading-8",
    subtitle:
      "mx-auto mt-3 max-w-[19rem] text-center text-[15px] font-semibold leading-6 text-[color:color-mix(in_srgb,var(--ui-text-muted)_86%,var(--ui-text))]",
    image: "mt-5 h-32 w-full rounded-[18px] object-cover lg:h-48",
    content:
      "mt-6 rounded-[20px] bg-[color:color-mix(in_srgb,var(--ui-surface)_88%,var(--ui-surface))] p-5",
  },
  summary: {
    label: "Summary",
    intro: "Wrap up",
    shell: "rounded-[24px] border border-[color:color-mix(in_srgb,var(--ui-learning)_20%,var(--ui-border-subtle))] bg-[color:color-mix(in_srgb,var(--ui-learning-bg)_68%,var(--ui-surface))] p-5 lg:p-6",
    badge: "bg-[var(--ui-learning)] text-[var(--ui-on-learning)]",
    title: "text-left text-[23px] font-black leading-8",
    subtitle:
      "mt-2.5 text-[15px] font-semibold leading-6 text-[color:color-mix(in_srgb,var(--ui-text-muted)_90%,var(--ui-text))]",
    image: "mt-5 h-32 w-full rounded-[18px] object-cover lg:h-48",
    content:
      "mt-6 rounded-[20px] border border-[color:color-mix(in_srgb,var(--ui-learning)_10%,var(--ui-border-subtle))] bg-[var(--ui-surface)] p-5",
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
  pageNumber,
  pageType,
  subtitle,
  title,
  totalPages,
}: LessonPageLayoutProps) {
  const config = getPageTypeConfig(pageType);
  const isImageBeforeTitle = pageType === "primer" || pageType === "concept";
  const emptyText = isPreview ? "Add a block to preview this page." : "No content yet.";
  const coverImageSizes = "(min-width: 1024px) 688px, (min-width: 768px) 608px, calc(100vw - 6rem)";

  return (
    <div className={config.shell}>
      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] ${config.badge}`}>
              {config.label}
            </span>
            <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[color:color-mix(in_srgb,var(--ui-text-muted)_90%,var(--ui-text))]">
              {config.intro}
            </span>
          </div>
          {pageNumber && totalPages ? (
            <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[var(--ui-text-muted)]">
              Page {pageNumber} of {totalPages}
            </span>
          ) : null}
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
          <div className="rounded-[18px] border border-dashed border-[var(--ui-border)] px-4 py-8 text-center text-xs font-bold text-[var(--ui-text-muted)]">
            {emptyText}
          </div>
        ) : (
          <LessonContent blocks={blocks} variant={pageType} isPreview={isPreview} />
        )}
      </div>
    </div>
  );
}

export function LessonPageCard(props: LessonPageLayoutProps) {
  return (
    <Card className="learner-readable overflow-hidden">
      <div className="px-6 py-7 lg:px-10 lg:py-10">
        <LessonPageLayout {...props} />
      </div>
    </Card>
  );
}
