/** Decode the database-owned snapshot; never substitute mutable draft content. */
export type PublishedPageRow = {
  id: string;
  lesson_id: string;
  page_number: number;
  title: string;
  subtitle: string | null;
  page_type: string;
  cover_image: Record<string, unknown> | null;
};
export type PublishedBlockRow = {
  id: string;
  page_id: string;
  block_type: string;
  sort_order: number;
  payload: Record<string, unknown>;
};
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Published lesson snapshot is invalid.");
  }
  return value as Record<string, unknown>;
}
function string(value: unknown): string {
  if (typeof value !== "string") throw new Error("Published lesson snapshot is invalid.");
  return value;
}
function integer(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value)) throw new Error("Published lesson snapshot is invalid.");
  return value;
}
export function publishedLessonContent(lessonId: string, input: unknown) {
  const snapshot = record(input);
  if (!Array.isArray(snapshot.pages) || !Array.isArray(snapshot.blocks)) {
    throw new Error("Published lesson snapshot is missing pages or blocks.");
  }
  const pages: PublishedPageRow[] = snapshot.pages.map((input) => {
    const page = record(input);
    return {
      id: string(page.id), lesson_id: lessonId, page_number: integer(page.page_number),
      title: string(page.title), subtitle: page.subtitle == null ? null : string(page.subtitle),
      page_type: string(page.page_type), cover_image: page.cover_image == null ? null : record(page.cover_image),
    };
  });
  const pageIds = new Set(pages.map((page) => page.id));
  const blocks: PublishedBlockRow[] = snapshot.blocks.map((input) => {
    const block = record(input);
    const pageId = string(block.page_id);
    if (!pageIds.has(pageId)) throw new Error("Published block belongs to a different lesson.");
    return { id: string(block.id), page_id: pageId, block_type: string(block.block_type),
      sort_order: integer(block.sort_order), payload: record(block.payload) };
  });
  return { pages, blocks };
}
