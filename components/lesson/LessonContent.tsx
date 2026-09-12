import { MediaAudio, MediaVideo } from "@/components/media/MediaPlayback";
import Image from "@/components/media/MediaImage";
import type { LessonContentBlock, LessonPageType } from "@/lib/lessons";
import { getImageFitClass, getImagePresentationStyle } from "@/lib/image-presentation";
import { containsRichTextHtml, sanitizeRichTextHtml } from "@/lib/rich-text";

type LessonContentProps = {
  blocks: LessonContentBlock[];
  variant?: LessonPageType | string;
  isPreview?: boolean;
};

function RichTextBody({
  body,
  className,
}: {
  body: string;
  className: string;
}) {
  if (!containsRichTextHtml(body)) {
    return <p className={className}>{body}</p>;
  }

  return (
    <div
      className={`${className} [&_a]:font-black [&_a]:text-[var(--ui-action)] [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-black [&_h3]:mb-2 [&_h3]:mt-3 [&_h3]:font-black [&_li]:ml-5 [&_ol]:my-2 [&_ol]:list-decimal [&_p]:my-2 [&_strong]:font-black [&_ul]:my-2 [&_ul]:list-disc`}
      dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(body) }}
    />
  );
}

export function LessonContent({ blocks, variant = "concept", isPreview = false }: LessonContentProps) {
  const isReflection = variant === "reflection";
  const isSummary = variant === "summary";
  const isExample = variant === "example";

  const stackClasses = isReflection ? "space-y-6" : "space-y-5";
  const textHeadingClasses = isReflection
    ? "text-[15px] font-black leading-6 text-[var(--ui-text)]"
    : "text-[15px] font-black leading-6 text-[var(--ui-text)]";
  const textBodyClasses = isSummary
    ? "mt-2 text-[15px] font-medium leading-7 text-[color:color-mix(in_srgb,var(--ui-text-muted)_92%,var(--ui-text))]"
    : isReflection
      ? "mt-2 text-[15px] font-medium leading-7 text-[color:color-mix(in_srgb,var(--ui-text-muted)_88%,var(--ui-text))]"
      : "mt-2 text-[15px] font-medium leading-7 text-[color:color-mix(in_srgb,var(--ui-text-muted)_94%,var(--ui-text))]";
  const calloutShellClasses = isReflection
    ? "rounded-[20px] border p-5"
    : "rounded-[20px] border p-5";
  const calloutTitleClasses = isSummary
    ? "mt-2 text-[16px] font-black leading-6 text-[var(--ui-text)]"
    : "mt-2 text-[15px] font-black leading-6 text-[var(--ui-text)]";
  const calloutBodyClasses = isReflection
    ? "mt-2 text-[14px] leading-6 text-[color:color-mix(in_srgb,var(--ui-text-muted)_90%,var(--ui-text))]"
    : "mt-2 text-[14px] leading-6 text-[color:color-mix(in_srgb,var(--ui-text-muted)_94%,var(--ui-text))]";
  const tableHeaderClasses = isExample || isSummary
    ? "px-4 py-3.5 text-[13px] font-black"
    : "px-4 py-3.5 text-[13px] font-bold";
  const tableCellClasses = isReflection
    ? "px-4 py-3.5 text-[14px] leading-6 text-[color:color-mix(in_srgb,var(--ui-text-muted)_88%,var(--ui-text))]"
    : "px-4 py-3.5 text-[14px] leading-6 text-[color:color-mix(in_srgb,var(--ui-text-muted)_94%,var(--ui-text))]";

  const calloutToneClasses: Record<string, string> = {
    tip: "border-[color:color-mix(in_srgb,var(--ui-info)_20%,var(--ui-border-subtle))] bg-[color:color-mix(in_srgb,var(--ui-info-bg)_74%,var(--ui-surface))]",
    key_point:
      "border-[color:color-mix(in_srgb,var(--ui-info)_20%,var(--ui-border-subtle))] bg-[color:color-mix(in_srgb,var(--ui-info-bg)_74%,var(--ui-surface))]",
    warning:
      "border-[color:color-mix(in_srgb,var(--ui-warning)_22%,var(--ui-border-subtle))] bg-[color:color-mix(in_srgb,var(--ui-warning-bg)_72%,var(--ui-surface))]",
    example:
      "border-[color:color-mix(in_srgb,var(--ui-text)_18%,var(--ui-border-subtle))] bg-[color:color-mix(in_srgb,var(--ui-support-bg)_72%,var(--ui-surface))]",
  };

  const calloutLabelClasses: Record<string, string> = {
    tip: "text-[var(--ui-info)]",
    key_point: "text-[var(--ui-info)]",
    warning: "text-[var(--ui-warning)]",
    example: "text-[var(--ui-text)]",
  };

  return (
    <div className={`${stackClasses} text-left`}>
      {blocks.map((block) => {
        if (block.type === "media_placeholder") return isPreview ? (
          <aside key={block.id} className="rounded-2xl border border-dashed border-[var(--ui-border-subtle)] p-5">
            <p className="text-sm font-bold capitalize">{block.kind} placeholder · Optional</p>
            <p className="mt-2 text-sm leading-6">{block.purpose}</p>
            <p className="mt-2 text-xs">Choose media in the editor. Empty placeholders aren’t shown to learners.</p>
          </aside>
        ) : null;
        if ((block.type === "image" || block.type === "video" || block.type === "audio") && !block.src.trim()) return null;
        if (block.type === "text") {
          return (
            <section key={block.id}>
              {block.heading ? (
                <h3 className={textHeadingClasses}>{block.heading}</h3>
              ) : null}
              <RichTextBody body={block.body} className={textBodyClasses} />
            </section>
          );
        }

        if (block.type === "callout") {
          const toneClasses = calloutToneClasses[block.variant] ?? calloutToneClasses.tip;
          const labelClasses = calloutLabelClasses[block.variant] ?? calloutLabelClasses.tip;
          const displayLabel = block.label || block.variant.replace("_", " ");

          return (
            <section
              className={`${calloutShellClasses} ${toneClasses}`}
              key={block.id}
            >
              <p className={`text-[11px] font-black uppercase tracking-[0.12em] ${labelClasses}`}>
                {displayLabel}
              </p>
              {block.title ? (
                <h3 className={calloutTitleClasses}>{block.title}</h3>
              ) : null}
              <RichTextBody body={block.body} className={calloutBodyClasses} />
            </section>
          );
        }

        if (block.type === "image") {
          return (
            <figure key={block.id}>
              <Image
                alt={block.alt}
                className={`w-full rounded-[18px] ${getImageFitClass(block)}`}
                height={506}
                src={block.src}
                style={getImagePresentationStyle(block)}
                width={900}
              />
              {block.caption ? (
                <figcaption className="mt-3 text-center text-[12px] font-semibold leading-5 text-[var(--ui-text-muted)]">
                  {block.caption}
                </figcaption>
              ) : null}
            </figure>
          );
        }

        if (block.type === "video") {
          const isPlaceholder = block.src.includes("placeholder");

          return (
            <figure key={block.id}>
              {isPlaceholder ? (
                <div className="grid aspect-video w-full place-items-center rounded-[18px] border border-dashed border-[var(--ui-border)] bg-[var(--ui-surface-raised)] px-5 text-center">
                  <div>
                    {block.title ? <p className="text-sm font-bold">{block.title}</p> : null}
                    <p className="mt-2 text-xs leading-5 text-[var(--ui-text-muted)]">
                      Video media placeholder
                    </p>
                  </div>
                </div>
              ) : (
                <MediaVideo
                  className="w-full rounded-[18px]"
                  controls
                  poster={block.poster}
                  preload="metadata"
                  src={block.src}
                />
              )}
              {block.caption ? (
                <figcaption className="mt-2 text-center text-[11px] font-semibold text-[var(--ui-text-muted)]">
                  {block.caption}
                </figcaption>
              ) : null}
            </figure>
          );
        }

        if (block.type === "audio") {
          const isPlaceholder = block.src.includes("placeholder");

          return (
            <section className="rounded-[18px] border border-[var(--ui-border)] p-4" key={block.id}>
              {block.title ? <p className="mb-3 text-[15px] font-black leading-6">{block.title}</p> : null}
              {isPlaceholder ? (
                <div className="rounded-[14px] border border-dashed border-[var(--ui-border)] bg-[var(--ui-surface-raised)] px-4 py-3 text-sm font-semibold text-[var(--ui-text-muted)]">
                  Audio media placeholder
                </div>
              ) : (
                <MediaAudio className="w-full" controls preload="metadata" src={block.src} />
              )}
              {block.transcript ? (
                <p className="mt-3 text-[14px] leading-6 text-[var(--ui-text-muted)]">{block.transcript}</p>
              ) : null}
            </section>
          );
        }

        return (
          <section className="overflow-hidden rounded-[18px] border border-[var(--ui-border-subtle)]" key={block.id}>
            {block.title ? (
              <h3 className="border-b border-[var(--ui-border-subtle)] bg-[var(--ui-surface-raised)] px-4 py-3 text-[15px] font-black leading-6">
                {block.title}
              </h3>
            ) : null}
            <table className="w-full border-collapse text-left">
              <thead className="bg-[var(--ui-surface-soft)] text-[var(--ui-text-muted)]">
                <tr>
                  {block.columns.map((column) => (
                    <th className={tableHeaderClasses} key={column}>
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, rowIndex) => (
                  <tr className="border-t border-[var(--ui-border-subtle)]" key={`${block.id}-${rowIndex}`}>
                    {row.map((cell, cellIndex) => (
                      <td className={tableCellClasses} key={`${cell}-${cellIndex}`}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {block.caption ? (
              <p className="px-4 py-3 text-[12px] font-semibold leading-5 text-[var(--ui-text-muted)]">
                {block.caption}
              </p>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
