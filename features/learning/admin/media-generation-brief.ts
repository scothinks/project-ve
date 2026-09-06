import { mediaIntent } from "../../../lib/media-intent.ts";

export const MEDIA_BRIEF_MAX_LENGTH = 6000;

export type MediaBriefContext = {
  lesson: { title: string; description?: string | null };
  page: { title: string; subtitle?: string | null };
  blocks: { block_type: string; payload: Record<string, unknown> }[];
};

// This is a bounded plain-text brief, never HTML or a new provider request.
function plainText(value: unknown, limit: number) {
  if (typeof value !== "string") return "";
  return value.slice(0, 12000)
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, entity: string) =>
      ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " })[entity] ?? " ")
    .replace(/\s+/g, " ").trim().slice(0, limit);
}

export function mediaGenerationBrief(payload: Record<string, unknown>, context: MediaBriefContext): string | undefined {
  // An editor's deliberate blank is also an override; never replace their work.
  if (typeof payload.mediaBrief === "string") return payload.mediaBrief.slice(0, MEDIA_BRIEF_MAX_LENGTH);
  const intent = mediaIntent(payload);
  if (!intent) return undefined;
  const teaching = context.blocks.filter(block => ["text", "callout", "table"].includes(block.block_type))
    .slice(0, 12).map(({ payload: content }) => {
      const cells = Array.isArray(content.rows) ? content.rows.slice(0, 8).flat().slice(0, 40) : [];
      const columns = Array.isArray(content.columns) ? content.columns.slice(0, 10) : [];
      return [content.heading ?? content.title, content.body, ...columns, ...cells]
        .map(value => plainText(value, 700)).filter(Boolean).join(" — ");
    }).filter(Boolean).join("\n").slice(0, 2200);
  return [
    `Create ${intent.kind === "image" ? "an image" : intent.kind === "audio" ? "audio" : "a video"} for this lesson.`,
    `Purpose: ${plainText(intent.purpose, 1000)}`,
    `Lesson: ${plainText(context.lesson.title, 180)}`,
    context.lesson.description && `Lesson context: ${plainText(context.lesson.description, 700)}`,
    `Page: ${plainText(context.page.title, 180)}`,
    context.page.subtitle && `Page focus: ${plainText(context.page.subtitle, 300)}`,
    teaching && `Teaching content:\n${teaching}`,
    intent.kind !== "audio" && `Aspect ratio: ${intent.aspectRatio}`,
  ].filter(Boolean).join("\n\n").slice(0, MEDIA_BRIEF_MAX_LENGTH);
}
