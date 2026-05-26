import type { LessonContentBlock } from "@/lib/lessons";
import { getImageFitClass, getImagePresentationStyle } from "@/lib/image-presentation";

type LessonContentProps = {
  blocks: LessonContentBlock[];
};

export function LessonContent({ blocks }: LessonContentProps) {
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
    <div className="space-y-4 text-left">
      {blocks.map((block) => {
        if (block.type === "text") {
          return (
            <section key={block.id}>
              {block.heading ? (
                <h3 className="text-sm font-bold text-[var(--foreground)]">{block.heading}</h3>
              ) : null}
              <p className="mt-2 text-[13px] font-medium leading-[1.55] text-[#939393]">
                {block.body}
              </p>
            </section>
          );
        }

        if (block.type === "callout") {
          const toneClasses = calloutToneClasses[block.variant] ?? calloutToneClasses.tip;
          const labelClasses = calloutLabelClasses[block.variant] ?? calloutLabelClasses.tip;
          const displayLabel = block.label || block.variant.replace("_", " ");

          return (
            <section
              className={`rounded-[18px] border p-4 ${toneClasses}`}
              key={block.id}
            >
              <p className={`text-[11px] font-black uppercase tracking-[0.12em] ${labelClasses}`}>
                {displayLabel}
              </p>
              {block.title ? (
                <h3 className="mt-2 text-sm font-bold text-[var(--foreground)]">{block.title}</h3>
              ) : null}
              <p className="mt-2 text-xs leading-5 text-[var(--ve-muted-strong)]">{block.body}</p>
            </section>
          );
        }

        if (block.type === "image") {
          return (
            <figure key={block.id}>
              <img
                alt={block.alt}
                className={`w-full rounded-[18px] ${getImageFitClass(block)}`}
                src={block.src}
                style={getImagePresentationStyle(block)}
              />
              {block.caption ? (
                <figcaption className="mt-2 text-center text-[11px] font-semibold text-[var(--ve-muted)]">
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
              {block.title ? <p className="mb-3 text-sm font-bold">{block.title}</p> : null}
              {isPlaceholder ? (
                <div className="rounded-[14px] border border-dashed border-[var(--ve-line)] bg-[var(--ve-card-subtle)] px-4 py-3 text-xs font-semibold text-[var(--ve-muted)]">
                  Audio media placeholder
                </div>
              ) : (
                <audio className="w-full" controls preload="metadata" src={block.src} />
              )}
              {block.transcript ? (
                <p className="mt-3 text-xs leading-5 text-[var(--ve-muted)]">{block.transcript}</p>
              ) : null}
            </section>
          );
        }

        return (
          <section className="overflow-hidden rounded-[18px] border border-[var(--ve-line-soft)]" key={block.id}>
            {block.title ? (
              <h3 className="border-b border-[var(--ve-line-soft)] bg-[var(--ve-card-subtle)] px-4 py-3 text-sm font-bold">
                {block.title}
              </h3>
            ) : null}
            <table className="w-full border-collapse text-left text-xs">
              <thead className="bg-[var(--ve-panel-soft)] text-[var(--ve-muted-strong)]">
                <tr>
                  {block.columns.map((column) => (
                    <th className="px-3 py-3 font-bold" key={column}>
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, rowIndex) => (
                  <tr className="border-t border-[var(--ve-line-soft)]" key={`${block.id}-${rowIndex}`}>
                    {row.map((cell, cellIndex) => (
                      <td className="px-3 py-3 text-[var(--ve-muted-strong)]" key={`${cell}-${cellIndex}`}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {block.caption ? (
              <p className="px-4 py-3 text-[11px] font-semibold text-[var(--ve-muted)]">
                {block.caption}
              </p>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
