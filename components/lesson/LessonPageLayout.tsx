import { LessonContent } from "@/components/lesson/LessonContent";
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
    subtitle: "mx-auto mt-2 max-w-[18rem] text-center text-sm font-bold leading-5 text-[var(--ve-muted)]",
    image: "mb-5 h-28 w-full rounded-[20px] object-cover",
    content: "mt-5",
  },
  concept: {
    label: "Concept",
    intro: "Learn the idea",
    shell: "bg-[var(--ve-card)]",
    badge: "bg-[color:color-mix(in_srgb,var(--ve-sky)_18%,var(--ve-card))] text-[color:color-mix(in_srgb,var(--ve-sky)_75%,var(--foreground))]",
    title: "text-left text-[22px] font-black leading-7",
    subtitle: "mt-2 text-sm font-semibold leading-5 text-[var(--ve-muted)]",
    image: "mb-5 h-28 w-full rounded-[18px] object-cover",
    content: "mt-5",
  },
  example: {
    label: "Example",
    intro: "See it happen",
    shell: "rounded-[22px] border border-[color:color-mix(in_srgb,var(--ve-mission)_20%,var(--ve-line-soft))] bg-[color:color-mix(in_srgb,var(--ve-mission-soft)_82%,var(--ve-card))] p-4",
    badge: "bg-[color:color-mix(in_srgb,var(--ve-mission)_14%,var(--ve-card))] text-[#c94f2e]",
    title: "text-left text-[22px] font-black leading-7",
    subtitle: "mt-2 text-sm font-bold leading-5 text-[var(--ve-muted-strong)]",
    image: "mt-4 h-28 w-full rounded-[18px] object-cover",
    content: "mt-5 rounded-[18px] bg-[var(--ve-card)] p-4",
  },
  reflection: {
    label: "Reflection",
    intro: "Think it through",
    shell: "rounded-[24px] border border-[color:color-mix(in_srgb,#6750a4_22%,var(--ve-line-soft))] bg-[color:color-mix(in_srgb,#6750a4_12%,var(--ve-card))] p-5",
    badge: "bg-[var(--ve-card)] text-[#7f6ac0]",
    title: "text-center text-[23px] font-black leading-8",
    subtitle: "mx-auto mt-3 max-w-[18rem] text-center text-sm font-bold leading-5 text-[var(--ve-muted-strong)]",
    image: "mt-5 h-24 w-full rounded-[18px] object-cover",
    content: "mt-5 rounded-[18px] bg-[color:color-mix(in_srgb,var(--ve-card)_80%,transparent)] p-4",
  },
  summary: {
    label: "Summary",
    intro: "Wrap up",
    shell: "rounded-[24px] border border-[color:color-mix(in_srgb,var(--ve-green)_18%,var(--ve-line-soft))] bg-[color:color-mix(in_srgb,var(--ve-green-soft)_72%,var(--ve-card))] p-5",
    badge: "bg-[#087f5b] text-white",
    title: "text-left text-[23px] font-black leading-8",
    subtitle: "mt-2 text-sm font-bold leading-5 text-[var(--ve-muted-strong)]",
    image: "mt-5 h-24 w-full rounded-[18px] object-cover",
    content: "mt-5 rounded-[18px] bg-[var(--ve-card)] p-4",
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

  return (
    <div className={config.shell}>
      <div className={isPreview && config.shell === "bg-[var(--ve-card)]" ? "" : undefined}>
        <div className="mb-4 flex items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${config.badge}`}>
            {config.label}
          </span>
          <span className="text-[11px] font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]">
            {config.intro}
          </span>
        </div>

        {coverImage && isImageBeforeTitle ? (
          <img alt={coverImage.alt} className={config.image} src={coverImage.src} />
        ) : null}

        <h1 className={config.title}>{title}</h1>
        {subtitle ? <p className={config.subtitle}>{subtitle}</p> : null}

        {coverImage && !isImageBeforeTitle ? (
          <img alt={coverImage.alt} className={config.image} src={coverImage.src} />
        ) : null}
      </div>

      <div className={config.content}>
        {blocks.length === 0 ? (
          <div className="rounded-[18px] border border-dashed border-[var(--ve-line)] px-4 py-8 text-center text-xs font-bold text-[var(--ve-muted)]">
            {emptyText}
          </div>
        ) : (
          <LessonContent blocks={blocks} />
        )}
      </div>
    </div>
  );
}
