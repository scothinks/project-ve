import Image from "next/image";
import type { LessonContentBlock, LessonPageType } from "@/lib/lessons";
import { getImageFitClass, getImagePresentationStyle } from "@/lib/image-presentation";
import { containsRichTextHtml, sanitizeRichTextHtml } from "@/lib/rich-text";

type LessonContentProps = {
  blocks: LessonContentBlock[];
  variant?: LessonPageType | string;
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
      className={`${className} [&_a]:font-black [&_a]:text-[var(--ve-green)] [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-black [&_h3]:mb-2 [&_h3]:mt-3 [&_h3]:font-black [&_li]:ml-5 [&_ol]:my-2 [&_ol]:list-decimal [&_p]:my-2 [&_strong]:font-black [&_ul]:my-2 [&_ul]:list-disc`}
      dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(body) }}
    />
  );
}

export function LessonContent({ blocks, variant = "concept" }: LessonContentProps) {
  const isReflection = variant === "reflection";
  const isSummary = variant === "summary";
  const isExample = variant === "example";

  const stackClasses = isReflection ? "space-y-6" : "space-y-5";
  const textHeadingClasses = isReflection
    ? "text-[15px] font-black leading-6 text-[var(--foreground)]"
    : "text-[15px] font-black leading-6 text-[var(--foreground)]";
  const textBodyClasses = isSummary
    ? "mt-2 text-[15px] font-medium leading-7 text-[color:color-mix(in_srgb,var(--ve-muted-strong)_92%,var(--foreground))]"
    : isReflection
      ? "mt-2 text-[15px] font-medium leading-7 text-[color:color-mix(in_srgb,var(--ve-muted-strong)_88%,var(--foreground))]"
      : "mt-2 text-[15px] font-medium leading-7 text-[color:color-mix(in_srgb,var(--ve-muted-strong)_94%,var(--foreground))]";
  const calloutShellClasses = isReflection
    ? "rounded-[20px] border p-5"
    : "rounded-[20px] border p-5";
  const calloutTitleClasses = isSummary
    ? "mt-2 text-[16px] font-black leading-6 text-[var(--foreground)]"
    : "mt-2 text-[15px] font-black leading-6 text-[var(--foreground)]";
  const calloutBodyClasses = isReflection
    ? "mt-2 text-[14px] leading-6 text-[color:color-mix(in_srgb,var(--ve-muted-strong)_90%,var(--foreground))]"
    : "mt-2 text-[14px] leading-6 text-[color:color-mix(in_srgb,var(--ve-muted-strong)_94%,var(--foreground))]";
  const tableHeaderClasses = isExample || isSummary
    ? "px-4 py-3.5 text-[13px] font-black"
    : "px-4 py-3.5 text-[13px] font-bold";
  const tableCellClasses = isReflection
    ? "px-4 py-3.5 text-[14px] leading-6 text-[color:color-mix(in_srgb,var(--ve-muted-strong)_88%,var(--foreground))]"
    : "px-4 py-3.5 text-[14px] leading-6 text-[color:color-mix(in_srgb,var(--ve-muted-strong)_94%,var(--foreground))]";

  const calloutToneClasses: Record<string, string> = {
    tip: "border-[color:color-mix(in_srgb,var(--ve-green)_20%,var(--ve-line-soft))] bg-[color:color-mix(in_srgb,var(--ve-green-soft)_74%,var(--ve-card))]",
    key_point:
      "border-[color:color-mix(in_srgb,var(--ve-green)_20%,var(--ve-line-soft))] bg-[color:color-mix(in_srgb,var(--ve-green-soft)_74%,var(--ve-card))]",
    warning:
      "border-[color:color-mix(in_srgb,var(--ve-store)_22%,var(--ve-line-soft))] bg-[color:color-mix(in_srgb,var(--ve-store-soft)_72%,var(--ve-card))]",
    example:
      "border-[color:color-mix(in_srgb,var(--ve-mission)_18%,var(--ve-line-soft))] bg-[color:color-mix(in_srgb,var(--ve-mission-soft)_72%,var(--ve-card))]",
  };

  const calloutLabelClasses: Record<string, string> = {
    tip: "text-[var(--ve-green)]",
    key_point: "text-[var(--ve-green)]",
    warning: "text-[#b17a05]",
    example: "text-[#d66d50]",
  };

  return (
    <div className={`${stackClasses} text-left`}>
      {blocks.map((block) => {
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
              <p className={calloutBodyClasses}>{block.body}</p>
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
                <figcaption className="mt-3 text-center text-[12px] font-semibold leading-5 text-[var(--ve-muted-strong)]">
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
                <div className="grid min-h-36 place-items-center rounded-[18px] border border-dashed border-[var(--ve-line)] bg-[var(--ve-card-subtle)] px-5 text-center">
                  <div>
                    {block.title ? <p className="text-sm font-bold">{block.title}</p> : null}
                    <p className="mt-2 text-xs leading-5 text-[var(--ve-muted)]">
                      Video media placeholder
                    </p>
                  </div>
                </div>
              ) : (
                <video
                  className="w-full rounded-[18px]"
                  controls
                  poster={block.poster}
                  preload="metadata"
                  src={block.src}
                />
              )}
              {block.caption ? (
                <figcaption className="mt-2 text-center text-[11px] font-semibold text-[var(--ve-muted)]">
                  {block.caption}
                </figcaption>
              ) : null}
            </figure>
          );
        }

        if (block.type === "audio") {
          const isPlaceholder = block.src.includes("placeholder");

          return (
            <section className="rounded-[18px] border border-[var(--ve-line)] p-4" key={block.id}>
              {block.title ? <p className="mb-3 text-[15px] font-black leading-6">{block.title}</p> : null}
              {isPlaceholder ? (
                <div className="rounded-[14px] border border-dashed border-[var(--ve-line)] bg-[var(--ve-card-subtle)] px-4 py-3 text-sm font-semibold text-[var(--ve-muted-strong)]">
                  Audio media placeholder
                </div>
              ) : (
                <audio className="w-full" controls preload="metadata" src={block.src} />
              )}
              {block.transcript ? (
                <p className="mt-3 text-[14px] leading-6 text-[var(--ve-muted-strong)]">{block.transcript}</p>
              ) : null}
            </section>
          );
        }

        return (
          <section className="overflow-hidden rounded-[18px] border border-[var(--ve-line-soft)]" key={block.id}>
            {block.title ? (
              <h3 className="border-b border-[var(--ve-line-soft)] bg-[var(--ve-card-subtle)] px-4 py-3 text-[15px] font-black leading-6">
                {block.title}
              </h3>
            ) : null}
            <table className="w-full border-collapse text-left">
              <thead className="bg-[var(--ve-panel-soft)] text-[var(--ve-muted-strong)]">
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
                  <tr className="border-t border-[var(--ve-line-soft)]" key={`${block.id}-${rowIndex}`}>
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
              <p className="px-4 py-3 text-[12px] font-semibold leading-5 text-[var(--ve-muted-strong)]">
                {block.caption}
              </p>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
