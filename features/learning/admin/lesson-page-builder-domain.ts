import { parseImagePresentation } from "../../../lib/image-presentation.ts";
import type {
  AdminLessonBlockRow,
  AdminLessonPageRow,
} from "@/lib/admin";
import type { CalloutBlock, ImageAsset, LessonContentBlock } from "@/lib/lessons";

export type DraftBlock = AdminLessonBlockRow & {
  isDraft?: boolean;
};

export type BuilderDraftSnapshot = {
  selectedPageId: string;
  pages: AdminLessonPageRow[];
  blocks: DraftBlock[];
};

export type BuilderSaveResponse = {
  status: string;
  notice?: string;
  pages?: Array<{
    clientId: string;
    pageId: string;
    status: string;
  }>;
  blocks?: Array<{
    clientId: string;
    blockId: string;
    pageId: string;
    sortOrder: number;
    status: string;
  }>;
  savedAt?: string;
};

export type ReorderDirection = "up" | "down";

export function getPayloadString(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "string" ? value : "";
}

export function getPayloadStringArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
}

export function getPayloadRows(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((row) =>
      Array.isArray(row)
        ? row.map((cell) => String(cell).trim())
        : String(row)
            .split(",")
            .map((cell) => cell.trim()),
    )
    .filter((row) => row.some(Boolean));
}

export function getImageValue(
  image: Record<string, unknown> | null | undefined,
  key: "src" | "alt",
) {
  const value = image?.[key];
  return typeof value === "string" ? value : "";
}

export function toPreviewImageAsset(
  image: Record<string, unknown> | null | undefined,
  fallbackAlt: string,
): ImageAsset | null {
  const src = getImageValue(image, "src");
  if (!src) return null;
  const presentation = parseImagePresentation(image);

  return {
    src,
    alt: getImageValue(image, "alt") || fallbackAlt,
    fit: presentation.fit,
    positionX: presentation.positionX,
    positionY: presentation.positionY,
  };
}

export function getPreviewCalloutVariant(value: string): CalloutBlock["variant"] {
  if (value === "tip" || value === "warning" || value === "example") return value;
  return "key_point";
}

export function isDraftId(value: string) {
  return value.startsWith("draft-");
}

export function createDraftId(prefix: string) {
  return `draft-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createBuilderSnapshotKey(
  pages: AdminLessonPageRow[],
  blocks: DraftBlock[],
) {
  const normalizedPages = [...pages]
    .sort((first, second) => first.page_number - second.page_number || first.id.localeCompare(second.id))
    .map((page) => ({
      id: page.id,
      title: page.title,
      subtitle: page.subtitle ?? "",
      page_type: page.page_type,
      page_number: page.page_number,
      cover_image: page.cover_image ?? {},
    }));
  const normalizedBlocks = [...blocks]
    .sort((first, second) => {
      if (first.page_id !== second.page_id) return first.page_id.localeCompare(second.page_id);
      if (first.sort_order !== second.sort_order) return first.sort_order - second.sort_order;
      return first.id.localeCompare(second.id);
    })
    .map((block) => ({
      id: block.id,
      page_id: block.page_id,
      block_type: block.block_type,
      sort_order: block.sort_order,
      payload: block.payload ?? {},
      isDraft: block.isDraft === true,
    }));

  return JSON.stringify({
    pages: normalizedPages,
    blocks: normalizedBlocks,
  });
}

export function reconcileBuilderStateFromSave(
  currentPages: AdminLessonPageRow[],
  currentBlocks: DraftBlock[],
  currentSelectedPageId: string,
  response: BuilderSaveResponse,
) {
  const pageResults = Array.isArray(response.pages) ? response.pages : [];
  const blockResults = Array.isArray(response.blocks) ? response.blocks : [];
  const pageIdMap = new Map(pageResults.map((item) => [item.clientId, item.pageId]));
  const blockResultMap = new Map(blockResults.map((item) => [item.clientId, item]));

  const nextPages = currentPages.map((page) => {
    const savedPageId = pageIdMap.get(page.id);
    return savedPageId ? { ...page, id: savedPageId } : page;
  });

  const nextBlocks = currentBlocks.map((block) => {
    const savedBlock = blockResultMap.get(block.id);
    const resolvedPageId = pageIdMap.get(block.page_id) ?? block.page_id;

    if (savedBlock) {
      return {
        ...block,
        id: savedBlock.blockId,
        page_id: savedBlock.pageId,
        sort_order: savedBlock.sortOrder,
        isDraft: false,
      };
    }

    if (resolvedPageId !== block.page_id) {
      return {
        ...block,
        page_id: resolvedPageId,
      };
    }

    return block;
  });

  return {
    pages: nextPages,
    blocks: nextBlocks,
    selectedPageId: pageIdMap.get(currentSelectedPageId) ?? currentSelectedPageId,
  };
}

export function updateBlockPayload(
  blocks: DraftBlock[],
  blockId: string,
  key: string,
  value: unknown,
) {
  return blocks.map((block) =>
    block.id === blockId
      ? {
          ...block,
          payload: {
            ...block.payload,
            [key]: value,
          },
        }
      : block,
  );
}

export function swapPageOrder(
  pages: AdminLessonPageRow[],
  pageId: string,
  direction: ReorderDirection,
) {
  const sorted = [...pages].sort((first, second) => first.page_number - second.page_number);
  const index = sorted.findIndex((page) => page.id === pageId);
  const targetIndex = direction === "up" ? index - 1 : index + 1;

  if (index < 0 || targetIndex < 0 || targetIndex >= sorted.length) {
    return pages;
  }

  const current = sorted[index];
  const target = sorted[targetIndex];

  return pages.map((page) => {
    if (page.id === current.id) return { ...page, page_number: target.page_number };
    if (page.id === target.id) return { ...page, page_number: current.page_number };
    return page;
  });
}

export function reorderPagesById(
  pages: AdminLessonPageRow[],
  activePageId: string,
  overPageId: string,
) {
  const sorted = [...pages].sort((first, second) => first.page_number - second.page_number);
  const activeIndex = sorted.findIndex((page) => page.id === activePageId);
  const overIndex = sorted.findIndex((page) => page.id === overPageId);

  if (activeIndex < 0 || overIndex < 0 || activeIndex === overIndex) {
    return pages;
  }

  const [activePage] = sorted.splice(activeIndex, 1);
  sorted.splice(overIndex, 0, activePage);
  const nextNumberById = new Map(sorted.map((page, index) => [page.id, index + 1]));

  return pages.map((page) => ({
    ...page,
    page_number: nextNumberById.get(page.id) ?? page.page_number,
  }));
}

export function swapBlockOrder(
  blocks: DraftBlock[],
  blockId: string,
  direction: ReorderDirection,
) {
  const currentBlock = blocks.find((block) => block.id === blockId);
  if (!currentBlock) return blocks;

  const sortedPageBlocks = blocks
    .filter((block) => block.page_id === currentBlock.page_id)
    .sort((first, second) => first.sort_order - second.sort_order);
  const index = sortedPageBlocks.findIndex((block) => block.id === blockId);
  const targetIndex = direction === "up" ? index - 1 : index + 1;

  if (index < 0 || targetIndex < 0 || targetIndex >= sortedPageBlocks.length) {
    return blocks;
  }

  const target = sortedPageBlocks[targetIndex];

  return blocks.map((block) => {
    if (block.id === currentBlock.id) return { ...block, sort_order: target.sort_order };
    if (block.id === target.id) return { ...block, sort_order: currentBlock.sort_order };
    return block;
  });
}

export function reorderBlocksById(
  blocks: DraftBlock[],
  activeBlockId: string,
  overBlockId: string,
) {
  const activeBlock = blocks.find((block) => block.id === activeBlockId);
  const overBlock = blocks.find((block) => block.id === overBlockId);

  if (!activeBlock || !overBlock || activeBlock.page_id !== overBlock.page_id) {
    return blocks;
  }

  const sorted = blocks
    .filter((block) => block.page_id === activeBlock.page_id)
    .sort((first, second) => first.sort_order - second.sort_order);
  const activeIndex = sorted.findIndex((block) => block.id === activeBlockId);
  const overIndex = sorted.findIndex((block) => block.id === overBlockId);

  if (activeIndex < 0 || overIndex < 0 || activeIndex === overIndex) {
    return blocks;
  }

  const [movedBlock] = sorted.splice(activeIndex, 1);
  sorted.splice(overIndex, 0, movedBlock);
  const nextOrderById = new Map(sorted.map((block, index) => [block.id, index + 1]));

  return blocks.map((block) =>
    block.page_id === activeBlock.page_id
      ? {
          ...block,
          sort_order: nextOrderById.get(block.id) ?? block.sort_order,
        }
      : block,
  );
}

export function insertBlockAtPosition(
  blocks: DraftBlock[],
  pageId: string,
  block: DraftBlock,
  insertIndex: number,
) {
  const pageBlocks = blocks
    .filter((item) => item.page_id === pageId)
    .sort((first, second) => first.sort_order - second.sort_order);
  const otherBlocks = blocks.filter((item) => item.page_id !== pageId);
  const boundedIndex = Math.max(0, Math.min(insertIndex, pageBlocks.length));

  pageBlocks.splice(boundedIndex, 0, block);

  return [
    ...otherBlocks,
    ...pageBlocks.map((item, index) => ({
      ...item,
      sort_order: index + 1,
    })),
  ];
}

export function mapPreviewBlock(block: DraftBlock): LessonContentBlock {
  const payload = block.payload ?? {};
  const title = getPayloadString(payload, "title") || getPayloadString(payload, "heading");

  if (block.block_type === "callout") {
    return {
      id: block.id,
      type: "callout",
      variant: getPreviewCalloutVariant(getPayloadString(payload, "variant")),
      label: getPayloadString(payload, "label") || undefined,
      title: title || undefined,
      body: getPayloadString(payload, "body") || "Callout text appears here.",
    };
  }

  if (block.block_type === "image") {
    const positionX = Number(payload.positionX);
    const positionY = Number(payload.positionY);

    return {
      id: block.id,
      type: "image",
      src:
        getPayloadString(payload, "src") ||
        "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=900&q=80",
      alt: getPayloadString(payload, "alt") || "Lesson image",
      caption: getPayloadString(payload, "caption") || undefined,
      fit: payload.fit === "contain" ? "contain" : "cover",
      positionX: Number.isFinite(positionX) ? positionX : 50,
      positionY: Number.isFinite(positionY) ? positionY : 50,
    };
  }

  if (block.block_type === "video") {
    return {
      id: block.id,
      type: "video",
      src: getPayloadString(payload, "src") || "placeholder",
      title: title || "Video",
      caption: getPayloadString(payload, "caption") || undefined,
    };
  }

  if (block.block_type === "audio") {
    return {
      id: block.id,
      type: "audio",
      src: getPayloadString(payload, "src") || "placeholder",
      title: title || "Audio",
      transcript:
        getPayloadString(payload, "transcript") ||
        getPayloadString(payload, "body") ||
        undefined,
    };
  }

  if (block.block_type === "table") {
    return {
      id: block.id,
      type: "table",
      title: title || undefined,
      columns: getPayloadStringArray(payload.columns),
      rows: getPayloadRows(payload.rows),
      caption: getPayloadString(payload, "caption") || undefined,
    };
  }

  return {
    id: block.id,
    type: "text",
    heading: title || undefined,
    body: getPayloadString(payload, "body") || "Write the lesson text here.",
  };
}

export function mergeDraftPages(
  serverPages: AdminLessonPageRow[],
  draftPages: AdminLessonPageRow[],
) {
  const draftById = new Map(draftPages.map((page) => [page.id, page]));
  return serverPages.map((page) => draftById.get(page.id) ?? page);
}

export function mergeDraftBlocks(
  serverBlocks: AdminLessonBlockRow[],
  draftBlocks: DraftBlock[],
) {
  const serverById = new Map(serverBlocks.map((block) => [block.id, block]));
  const mergedServerBlocks = serverBlocks.map((block) => {
    const draft = draftBlocks.find((item) => item.id === block.id);
    return draft ? { ...block, payload: draft.payload, sort_order: draft.sort_order, page_id: draft.page_id } : block;
  });

  const draftOnlyBlocks = draftBlocks.filter((block) => block.isDraft || !serverById.has(block.id));
  return [...mergedServerBlocks, ...draftOnlyBlocks];
}

export function blockSummary(block: DraftBlock) {
  const payload = block.payload ?? {};
  return String(payload.title ?? payload.heading ?? payload.body ?? payload.src ?? "")
    .replace(/<[^>]*>/g, " ")
    .trim()
    .slice(0, 80);
}
