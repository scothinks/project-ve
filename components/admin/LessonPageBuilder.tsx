"use client";

import Link from "next/link";
import { ArrowLeftIcon, MenuIcon } from "@/components/ui/Icons";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { parseImagePresentation } from "@/lib/image-presentation";
import { EmptyAdminState, AdminStatusBadge } from "@/components/admin/AdminPrimitives";
import { LessonPageLayout } from "@/components/lesson/LessonPageLayout";
import type {
  AdminLessonBlockRow,
  AdminLessonPageRow,
  AdminLessonRow,
} from "@/lib/admin";
import type { CalloutBlock, ImageAsset, LessonContentBlock } from "@/lib/lessons";

type DraftBlock = AdminLessonBlockRow & {
  isDraft?: boolean;
};

type LessonPageBuilderProps = {
  lesson: AdminLessonRow;
  pages: AdminLessonPageRow[];
  blocks: AdminLessonBlockRow[];
  initialPageId?: string;
};

type BuilderDraftSnapshot = {
  selectedPageId: string;
  pages: AdminLessonPageRow[];
  blocks: DraftBlock[];
};

type BuilderSaveResponse = {
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

type AutosaveState = "idle" | "dirty" | "saving" | "saved" | "error";

const blockToolbarItems = [
  { type: "text", label: "Text" },
  { type: "callout", label: "Callout" },
  { type: "image", label: "Image" },
  { type: "video", label: "Video" },
  { type: "audio", label: "Audio" },
  { type: "table", label: "Table" },
];

const AUTOSAVE_DELAY_MS = 15_000;

function ArrowUpIcon() {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 16 16">
      <path
        d="M8 13V3m0 0L4 7m4-4 4 4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function ArrowDownIcon() {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 16 16">
      <path
        d="M8 3v10m0 0 4-4m-4 4-4-4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 16 16">
      <path
        d="M3 4h10m-8 0V3h6v1m-7 0 .5 9h7L12 4M6.5 7v4m3-4v4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function actionButtonClasses(tone: "neutral" | "danger" = "neutral") {
  const toneClasses =
    tone === "danger"
      ? "bg-[color:color-mix(in_srgb,var(--ve-danger-soft)_82%,var(--ve-card))] text-[var(--ve-danger)] hover:bg-[color:color-mix(in_srgb,var(--ve-danger-soft)_92%,var(--ve-card))]"
      : "bg-[var(--ve-panel)] text-[var(--foreground)] hover:bg-[color:color-mix(in_srgb,var(--ve-green-soft)_76%,var(--ve-panel))] hover:text-[var(--ve-green)]";

  return `inline-flex h-8 w-8 items-center justify-center rounded-full ${toneClasses} transition disabled:cursor-not-allowed disabled:opacity-35`;
}

function compactFieldClasses() {
  return "mt-2 w-full rounded-[12px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 py-2 text-sm font-bold outline-none transition focus:border-[var(--ve-green)] focus:ring-4 focus:ring-[color:color-mix(in_srgb,var(--ve-green)_10%,transparent)]";
}

function labelClasses() {
  return "text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]";
}

function getPayloadString(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "string" ? value : "";
}

function getPayloadStringArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
}

function getPayloadRows(value: unknown) {
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

function getImageValue(image: Record<string, unknown> | null | undefined, key: "src" | "alt") {
  const value = image?.[key];
  return typeof value === "string" ? value : "";
}

function toPreviewImageAsset(
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

function getPreviewCalloutVariant(value: string): CalloutBlock["variant"] {
  if (value === "tip" || value === "warning" || value === "example") return value;
  return "key_point";
}

function isDraftId(value: string) {
  return value.startsWith("draft-");
}

function createBuilderSnapshotKey(
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

function reconcileBuilderStateFromSave(
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

function updateBlockPayload(
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

function swapPageOrder(pages: AdminLessonPageRow[], pageId: string, direction: "up" | "down") {
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

function swapBlockOrder(blocks: DraftBlock[], blockId: string, direction: "up" | "down") {
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

function mapPreviewBlock(block: DraftBlock): LessonContentBlock {
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
    return {
      id: block.id,
      type: "image",
      src:
        getPayloadString(payload, "src") ||
        "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=900&q=80",
      alt: getPayloadString(payload, "alt") || "Lesson image",
      caption: getPayloadString(payload, "caption") || undefined,
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

function mergeDraftPages(
  serverPages: AdminLessonPageRow[],
  draftPages: AdminLessonPageRow[],
) {
  const draftById = new Map(draftPages.map((page) => [page.id, page]));
  return serverPages.map((page) => draftById.get(page.id) ?? page);
}

function mergeDraftBlocks(
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

function blockSummary(block: DraftBlock) {
  const payload = block.payload ?? {};
  return String(payload.title ?? payload.heading ?? payload.body ?? payload.src ?? "")
    .trim()
    .slice(0, 80);
}

function ReorderPageButtons({
  lessonId,
  pageId,
  isFirst,
  isLast,
  onReorder,
}: {
  lessonId: string;
  pageId: string;
  isFirst: boolean;
  isLast: boolean;
  onReorder: (pageId: string, direction: "up" | "down") => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function reorder(direction: "up" | "down") {
    onReorder(pageId, direction);
    if (isDraftId(pageId)) {
      return;
    }

    startTransition(() => {
      void fetch("/api/admin/learning/reorder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          kind: "page",
          lessonId,
          pageId,
          direction,
        }),
      })
        .then((response) => {
          if (!response.ok) {
            window.alert("The page order could not be saved. Refreshing to restore the latest version.");
            router.refresh();
          }
        })
        .catch(() => {
          window.alert("The page order could not be saved. Refreshing to restore the latest version.");
          router.refresh();
        });
    });
  }

  return (
    <div className="flex gap-1">
      <button
        aria-label="Move page earlier"
        className={actionButtonClasses()}
        disabled={isFirst || isPending}
        onClick={() => reorder("up")}
        title="Move earlier"
        type="button"
      >
        <ArrowUpIcon />
      </button>
      <button
        aria-label="Move page later"
        className={actionButtonClasses()}
        disabled={isLast || isPending}
        onClick={() => reorder("down")}
        title="Move later"
        type="button"
      >
        <ArrowDownIcon />
      </button>
    </div>
  );
}

function BlockActionButtons({
  block,
  isFirst,
  isLast,
  onReorder,
  onRemove,
}: {
  block: DraftBlock;
  isFirst: boolean;
  isLast: boolean;
  onReorder: (blockId: string, direction: "up" | "down") => void;
  onRemove: (block: DraftBlock) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (block.isDraft) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-[var(--ve-muted)]">Unsaved</span>
        <button
          aria-label="Remove draft block"
          className={actionButtonClasses("danger")}
          onClick={() => onRemove(block)}
          title="Remove block"
          type="button"
        >
          <TrashIcon />
        </button>
      </div>
    );
  }

  function reorder(direction: "up" | "down") {
    onReorder(block.id, direction);
    startTransition(() => {
      void fetch("/api/admin/learning/reorder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          kind: "block",
          pageId: block.page_id,
          blockId: block.id,
          direction,
        }),
      })
        .then((response) => {
          if (!response.ok) {
            window.alert("The block order could not be saved. Refreshing to restore the latest version.");
            router.refresh();
          }
        })
        .catch(() => {
          window.alert("The block order could not be saved. Refreshing to restore the latest version.");
          router.refresh();
        });
    });
  }

  return (
    <div className="flex gap-1">
      <button
        aria-label="Move block earlier"
        className={actionButtonClasses()}
        disabled={isFirst || isPending}
        onClick={() => reorder("up")}
        title="Move earlier"
        type="button"
      >
        <ArrowUpIcon />
      </button>
      <button
        aria-label="Move block later"
        className={actionButtonClasses()}
        disabled={isLast || isPending}
        onClick={() => reorder("down")}
        title="Move later"
        type="button"
      >
        <ArrowDownIcon />
      </button>
      <button
        aria-label="Remove block"
        className={actionButtonClasses("danger")}
        disabled={isPending}
        onClick={() => onRemove(block)}
        title="Remove block"
        type="button"
      >
        <TrashIcon />
      </button>
    </div>
  );
}

function AddPageButton({ onAddPage }: { onAddPage: () => void }) {
  return (
    <button
      className="inline-flex w-full items-center justify-center rounded-[14px] bg-[var(--ve-green)] px-4 py-3 text-sm font-black text-white transition hover:brightness-95"
      onClick={onAddPage}
      type="button"
    >
      + Add page
    </button>
  );
}

function PageSettingsEditor({
  page,
  onChange,
  onSaveNow,
  isSaving,
}: {
  page: AdminLessonPageRow;
  onChange: (page: AdminLessonPageRow) => void;
  onSaveNow: () => void;
  isSaving: boolean;
}) {
  const coverImage = page.cover_image ?? {};

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSaveNow();
      }}
    >
      <div className="grid gap-3 md:grid-cols-[1fr_10rem]">
        <label>
          <span className={labelClasses()}>Page title</span>
          <input
            className={compactFieldClasses()}
            name="title"
            required
            value={page.title}
            onChange={(event) => onChange({ ...page, title: event.target.value })}
          />
        </label>
        <label>
          <span className={labelClasses()}>Position</span>
          <input className={compactFieldClasses()} readOnly value={`Page ${page.page_number}`} />
        </label>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label>
          <span className={labelClasses()}>Subtitle</span>
          <input
            className={compactFieldClasses()}
            name="subtitle"
            value={page.subtitle ?? ""}
            onChange={(event) => onChange({ ...page, subtitle: event.target.value })}
          />
        </label>
        <label>
          <span className={labelClasses()}>Page type</span>
          <select
            className={compactFieldClasses()}
            name="pageType"
            value={page.page_type}
            onChange={(event) => onChange({ ...page, page_type: event.target.value })}
          >
            <option value="primer">Primer</option>
            <option value="concept">Concept</option>
            <option value="example">Example</option>
            <option value="reflection">Reflection</option>
            <option value="summary">Summary</option>
          </select>
        </label>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label>
          <span className={labelClasses()}>Page image URL</span>
          <input
            className={compactFieldClasses()}
            name="coverImageUrl"
            value={getImageValue(coverImage, "src")}
            onChange={(event) =>
              onChange({
                ...page,
                cover_image: {
                  ...coverImage,
                  src: event.target.value,
                },
              })
            }
          />
        </label>
        <label>
          <span className={labelClasses()}>Page image alt</span>
          <input
            className={compactFieldClasses()}
            name="coverImageAlt"
            value={getImageValue(coverImage, "alt")}
            onChange={(event) =>
              onChange({
                ...page,
                cover_image: {
                  ...coverImage,
                  alt: event.target.value,
                },
              })
            }
          />
        </label>
      </div>
      <button className="rounded-[12px] bg-[var(--ve-green)] px-4 py-2 text-xs font-black text-white disabled:opacity-60" disabled={isSaving} type="submit">
        {isSaving ? "Saving..." : "Save now"}
      </button>
    </form>
  );
}

function BlockEditor({
  block,
  isFirst,
  isLast,
  onPayloadChange,
  onReorder,
  onRemove,
  onSaveNow,
  isSaving,
}: {
  block: DraftBlock;
  isFirst: boolean;
  isLast: boolean;
  onPayloadChange: (key: string, value: unknown) => void;
  onReorder: (blockId: string, direction: "up" | "down") => void;
  onRemove: (block: DraftBlock) => void;
  onSaveNow: () => void;
  isSaving: boolean;
}) {
  const payload = block.payload ?? {};
  const title = String(payload.title ?? payload.heading ?? "");
  const body = String(payload.body ?? payload.transcript ?? "");

  function Header({ label }: { label: string }) {
    return (
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className={labelClasses()}>{label}</p>
          {blockSummary(block) ? (
            <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">{blockSummary(block)}</p>
          ) : null}
        </div>
        <BlockActionButtons
          block={block}
          isFirst={isFirst}
          isLast={isLast}
          onRemove={onRemove}
          onReorder={onReorder}
        />
      </div>
    );
  }

  if (block.block_type === "image") {
    return (
      <form
        className="space-y-3 rounded-[18px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] p-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSaveNow();
        }}
      >
        <Header label="Image block" />
        {typeof payload.aiManagedByAssetId === "string" && payload.aiManagedByAssetId ? (
          <>
            <input name="aiManagedByAssetId" type="hidden" value={payload.aiManagedByAssetId} />
            <input name="aiManagedKind" type="hidden" value={String(payload.aiManagedKind ?? "learning_media_asset")} />
            <input name="aiGenerated" type="hidden" value={payload.aiGenerated === true ? "true" : "false"} />
            <div className="rounded-[12px] border border-[var(--ve-line-soft)] bg-[var(--ve-panel)] px-3 py-2 text-xs font-semibold text-[var(--ve-muted)]">
              This image block is linked to an AI media brief. Editing the content here keeps that link intact.
            </div>
          </>
        ) : null}
        <label className="block">
          <span className={labelClasses()}>Image URL</span>
          <input
            className={compactFieldClasses()}
            name="src"
            value={String(payload.src ?? "")}
            onChange={(event) => onPayloadChange("src", event.target.value)}
          />
        </label>
        <div className="grid gap-3 md:grid-cols-2">
          <label>
            <span className={labelClasses()}>Alt text</span>
            <input
              className={compactFieldClasses()}
              name="alt"
              value={String(payload.alt ?? "")}
              onChange={(event) => onPayloadChange("alt", event.target.value)}
            />
          </label>
          <label>
            <span className={labelClasses()}>Caption</span>
            <input
              className={compactFieldClasses()}
              name="caption"
              value={String(payload.caption ?? "")}
              onChange={(event) => onPayloadChange("caption", event.target.value)}
            />
          </label>
        </div>
        <button className="rounded-[12px] bg-[var(--ve-green)] px-4 py-2 text-xs font-black text-white disabled:opacity-60" disabled={isSaving} type="submit">
          {isSaving ? "Saving..." : "Save now"}
        </button>
      </form>
    );
  }

  if (block.block_type === "video" || block.block_type === "audio") {
    const mediaLabel = block.block_type === "video" ? "Video" : "Audio";

    return (
      <form
        className="space-y-3 rounded-[18px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] p-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSaveNow();
        }}
      >
        <Header label={`${mediaLabel} block`} />
        <div className="grid gap-3 md:grid-cols-2">
          <label>
            <span className={labelClasses()}>{mediaLabel} title</span>
            <input
              className={compactFieldClasses()}
              name="heading"
              value={title}
              onChange={(event) => onPayloadChange("title", event.target.value)}
            />
          </label>
          <label>
            <span className={labelClasses()}>Media URL</span>
            <input
              className={compactFieldClasses()}
              name="src"
              value={String(payload.src ?? "")}
              onChange={(event) => onPayloadChange("src", event.target.value)}
            />
          </label>
        </div>
        <label className="block">
          <span className={labelClasses()}>Transcript / notes</span>
          <textarea
            className={`${compactFieldClasses()} min-h-24 resize-none`}
            name="body"
            value={body}
            onChange={(event) => onPayloadChange("body", event.target.value)}
          />
        </label>
        <label className="block">
          <span className={labelClasses()}>Caption</span>
          <input
            className={compactFieldClasses()}
            name="caption"
            value={String(payload.caption ?? "")}
            onChange={(event) => onPayloadChange("caption", event.target.value)}
          />
        </label>
        <button className="rounded-[12px] bg-[var(--ve-green)] px-4 py-2 text-xs font-black text-white disabled:opacity-60" disabled={isSaving} type="submit">
          {isSaving ? "Saving..." : "Save now"}
        </button>
      </form>
    );
  }

  if (block.block_type === "table") {
    const rowsValue = Array.isArray(payload.rows)
      ? payload.rows.map((row) => (Array.isArray(row) ? row.join(", ") : String(row))).join("\n")
      : "";

    return (
      <form
        className="space-y-3 rounded-[18px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] p-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSaveNow();
        }}
      >
        <Header label="Table block" />
        <div className="grid gap-3 md:grid-cols-2">
          <label>
            <span className={labelClasses()}>Table title</span>
            <input
              className={compactFieldClasses()}
              name="heading"
              value={title}
              onChange={(event) => onPayloadChange("title", event.target.value)}
            />
          </label>
          <label>
            <span className={labelClasses()}>Columns</span>
            <input
              className={compactFieldClasses()}
              name="columns"
              placeholder="Situation, Fair action"
              value={Array.isArray(payload.columns) ? payload.columns.join(", ") : ""}
              onChange={(event) =>
                onPayloadChange(
                  "columns",
                  event.target.value
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean),
                )
              }
            />
          </label>
        </div>
        <label className="block">
          <span className={labelClasses()}>Rows</span>
          <textarea
            className={`${compactFieldClasses()} min-h-28 resize-none font-mono text-xs`}
            name="rows"
            placeholder={"A queue is long, Wait your turn\nA teammate made a mistake, Correct kindly"}
            value={rowsValue}
            onChange={(event) =>
              onPayloadChange(
                "rows",
                event.target.value
                  .split("\n")
                  .map((row) => row.split(",").map((cell) => cell.trim()))
                  .filter((row) => row.some(Boolean)),
              )
            }
          />
        </label>
        <label className="block">
          <span className={labelClasses()}>Caption</span>
          <input
            className={compactFieldClasses()}
            name="caption"
            value={String(payload.caption ?? "")}
            onChange={(event) => onPayloadChange("caption", event.target.value)}
          />
        </label>
        <button className="rounded-[12px] bg-[var(--ve-green)] px-4 py-2 text-xs font-black text-white disabled:opacity-60" disabled={isSaving} type="submit">
          {isSaving ? "Saving..." : "Save now"}
        </button>
      </form>
    );
  }

  if (block.block_type === "callout") {
    return (
      <form
        className="space-y-3 rounded-[18px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] p-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSaveNow();
        }}
      >
        <Header label="Callout block" />
        <div className="grid gap-3 md:grid-cols-[10rem_1fr]">
          <label>
            <span className={labelClasses()}>Tone</span>
            <select
              className={compactFieldClasses()}
              name="variant"
              value={String(payload.variant ?? "key_point")}
              onChange={(event) => onPayloadChange("variant", event.target.value)}
            >
              <option value="key_point">Key point</option>
              <option value="tip">Tip</option>
              <option value="warning">Warning</option>
              <option value="example">Example</option>
            </select>
          </label>
          <label>
            <span className={labelClasses()}>Callout label</span>
            <input
              className={compactFieldClasses()}
              name="label"
              placeholder="Example: Think about this"
              value={String(payload.label ?? "")}
              onChange={(event) => onPayloadChange("label", event.target.value)}
            />
          </label>
        </div>
        <label className="block">
          <span className={labelClasses()}>Title</span>
          <input
            className={compactFieldClasses()}
            name="heading"
            placeholder="Optional"
            value={title}
            onChange={(event) => onPayloadChange("title", event.target.value)}
          />
        </label>
        <label className="block">
          <span className={labelClasses()}>Body</span>
          <textarea
            className={`${compactFieldClasses()} min-h-24 resize-none`}
            name="body"
            value={body}
            onChange={(event) => onPayloadChange("body", event.target.value)}
          />
        </label>
        <button className="rounded-[12px] bg-[var(--ve-green)] px-4 py-2 text-xs font-black text-white disabled:opacity-60" disabled={isSaving} type="submit">
          {isSaving ? "Saving..." : "Save now"}
        </button>
      </form>
    );
  }

  return (
    <form
      className="space-y-3 rounded-[18px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] p-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSaveNow();
      }}
    >
      <Header label="Text block" />
      <label className="block">
        <span className={labelClasses()}>Heading</span>
        <input
          className={compactFieldClasses()}
          name="heading"
          value={title}
          onChange={(event) => onPayloadChange("heading", event.target.value)}
        />
      </label>
      <label className="block">
        <span className={labelClasses()}>Text</span>
        <textarea
          className={`${compactFieldClasses()} min-h-36 resize-none text-base leading-7`}
          name="body"
          value={body}
          onChange={(event) => onPayloadChange("body", event.target.value)}
        />
      </label>
      <button className="rounded-[12px] bg-[var(--ve-green)] px-4 py-2 text-xs font-black text-white disabled:opacity-60" disabled={isSaving} type="submit">
        {isSaving ? "Saving..." : "Save now"}
      </button>
    </form>
  );
}

export function LessonPageBuilder({
  lesson,
  pages: initialPages,
  blocks: initialBlocks,
  initialPageId,
}: LessonPageBuilderProps) {
  const router = useRouter();
  const [pages, setPages] = useState(initialPages);
  const [blocks, setBlocks] = useState<DraftBlock[]>(initialBlocks);
  const [selectedPageId, setSelectedPageId] = useState(initialPageId ?? initialPages[0]?.id ?? "");
  const [autosaveState, setAutosaveState] = useState<AutosaveState>("idle");
  const [autosaveMessage, setAutosaveMessage] = useState("Autosaves after you stop editing.");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const storageKey = `lesson-builder-draft:${lesson.id}`;
  const hasHydratedDraftRef = useRef(false);
  const pagesRef = useRef(pages);
  const blocksRef = useRef(blocks);
  const selectedPageIdRef = useRef(selectedPageId);
  const saveTimerRef = useRef<number | null>(null);
  const saveInFlightRef = useRef(false);
  const queuedSaveRef = useRef(false);
  const lastSavedSnapshotRef = useRef(createBuilderSnapshotKey(initialPages, initialBlocks));
  const saveBuilderSnapshotRef = useRef<(force?: boolean) => Promise<void>>(async () => {});

  useEffect(() => {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) {
      hasHydratedDraftRef.current = true;
      return;
    }

    try {
      const snapshot = JSON.parse(raw) as Partial<BuilderDraftSnapshot>;
      if (Array.isArray(snapshot.pages)) {
        setPages(mergeDraftPages(initialPages, snapshot.pages));
      } else {
        setPages(initialPages);
      }

      if (Array.isArray(snapshot.blocks)) {
        setBlocks(mergeDraftBlocks(initialBlocks, snapshot.blocks));
      } else {
        setBlocks(initialBlocks);
      }

      if (typeof snapshot.selectedPageId === "string" && snapshot.selectedPageId) {
        setSelectedPageId(snapshot.selectedPageId);
      } else {
        setSelectedPageId(initialPageId ?? initialPages[0]?.id ?? "");
      }
      lastSavedSnapshotRef.current = createBuilderSnapshotKey(initialPages, initialBlocks);
    } catch {
      window.sessionStorage.removeItem(storageKey);
      setPages(initialPages);
      setBlocks(initialBlocks);
      setSelectedPageId(initialPageId ?? initialPages[0]?.id ?? "");
      lastSavedSnapshotRef.current = createBuilderSnapshotKey(initialPages, initialBlocks);
    } finally {
      hasHydratedDraftRef.current = true;
    }
  }, [initialBlocks, initialPageId, initialPages, storageKey]);

  useEffect(() => {
    pagesRef.current = pages;
    blocksRef.current = blocks;
    selectedPageIdRef.current = selectedPageId;
  }, [blocks, pages, selectedPageId]);

  useEffect(() => {
    if (!hasHydratedDraftRef.current) {
      return;
    }

    const snapshot: BuilderDraftSnapshot = {
      selectedPageId,
      pages,
      blocks,
    };

    window.sessionStorage.setItem(storageKey, JSON.stringify(snapshot));
  }, [blocks, pages, selectedPageId, storageKey]);

  useEffect(() => {
    if (!hasHydratedDraftRef.current) {
      return;
    }

    const snapshotKey = createBuilderSnapshotKey(pages, blocks);
    if (snapshotKey === lastSavedSnapshotRef.current) {
      return;
    }

    setAutosaveState((current) => (current === "saving" ? current : "dirty"));
    setAutosaveMessage("Unsaved changes. Autosaving soon.");

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      void saveBuilderSnapshotRef.current();
    }, AUTOSAVE_DELAY_MS);
  }, [blocks, pages]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  const sortedPages = useMemo(
    () => [...pages].sort((first, second) => first.page_number - second.page_number),
    [pages],
  );
  const selectedPage = sortedPages.find((page) => page.id === selectedPageId) ?? sortedPages[0] ?? null;
  const selectedPageIndex = selectedPage
    ? sortedPages.findIndex((page) => page.id === selectedPage.id)
    : -1;
  const selectedPageBlocks = useMemo(
    () =>
      selectedPage
        ? blocks
            .filter((block) => block.page_id === selectedPage.id)
            .sort((first, second) => first.sort_order - second.sort_order)
        : [],
    [blocks, selectedPage],
  );
  const nextBlockSortOrder =
    selectedPageBlocks.reduce((highest, block) => Math.max(highest, block.sort_order), 0) + 1;
  const selectedPreviewBlocks = selectedPageBlocks.map(mapPreviewBlock);
  const pageCoverImage =
    toPreviewImageAsset(selectedPage?.cover_image, selectedPage?.title ?? lesson.title) ??
    (selectedPageIndex === 0 ? toPreviewImageAsset(lesson.cover_image, lesson.title) : null);

  const saveBuilderSnapshot = useCallback(async (force = false) => {
    if (!hasHydratedDraftRef.current) {
      return;
    }

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const snapshotKey = createBuilderSnapshotKey(pagesRef.current, blocksRef.current);
    if (!force && snapshotKey === lastSavedSnapshotRef.current) {
      if (autosaveState !== "saved") {
        setAutosaveState("saved");
        setAutosaveMessage(lastSavedAt ? "All changes saved." : "Nothing new to save.");
      }
      return;
    }

    if (saveInFlightRef.current) {
      queuedSaveRef.current = true;
      return;
    }

    saveInFlightRef.current = true;
    setAutosaveState("saving");
    setAutosaveMessage("Saving changes...");

    try {
      const response = await fetch("/api/admin/learning/builder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lessonId: lesson.id,
          pages: pagesRef.current,
          blocks: blocksRef.current,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as BuilderSaveResponse & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "The lesson content could not be saved.");
      }

      const reconciled = reconcileBuilderStateFromSave(
        pagesRef.current,
        blocksRef.current,
        selectedPageIdRef.current,
        payload,
      );

      pagesRef.current = reconciled.pages;
      blocksRef.current = reconciled.blocks;
      selectedPageIdRef.current = reconciled.selectedPageId;
      setPages(reconciled.pages);
      setBlocks(reconciled.blocks);
      setSelectedPageId(reconciled.selectedPageId);

      lastSavedSnapshotRef.current = createBuilderSnapshotKey(reconciled.pages, reconciled.blocks);
      setAutosaveState("saved");
      setAutosaveMessage(payload.notice || "All changes saved.");
      setLastSavedAt(payload.savedAt ?? new Date().toISOString());
    } catch (error: unknown) {
      setAutosaveState("error");
      setAutosaveMessage(
        error instanceof Error ? error.message : "The lesson content could not be saved.",
      );
    } finally {
      saveInFlightRef.current = false;
      if (queuedSaveRef.current) {
        queuedSaveRef.current = false;
        void saveBuilderSnapshot();
      }
    }
  }, [autosaveState, lastSavedAt, lesson.id]);

  saveBuilderSnapshotRef.current = saveBuilderSnapshot;

  function addDraftBlock(blockType: string) {
    if (!selectedPage) return;

    setBlocks((current) => [
      ...current,
      {
        id: `draft-${Date.now()}-${blockType}`,
        page_id: selectedPage.id,
        block_type: blockType,
        sort_order: nextBlockSortOrder,
        payload:
          blockType === "callout"
            ? { variant: "key_point", label: "", title: "", body: "" }
            : blockType === "table"
              ? { title: "", columns: [], rows: [] }
              : {},
        isDraft: true,
      },
    ]);
  }

  function addDraftPage() {
    const nextPageNumber =
      sortedPages.reduce((highest, page) => Math.max(highest, page.page_number), 0) + 1;
    const draftId = `draft-page-${Date.now()}`;
    const timestamp = new Date().toISOString();

    setPages((current) => [
      ...current,
      {
        id: draftId,
        lesson_id: lesson.id,
        page_number: nextPageNumber,
        title: `Untitled page ${nextPageNumber}`,
        subtitle: null,
        page_type: "concept",
        cover_image: {},
        created_at: timestamp,
        updated_at: timestamp,
      },
    ]);
    setSelectedPageId(draftId);
  }

  function updateBlock(blockId: string, key: string, value: unknown) {
    setBlocks((current) => updateBlockPayload(current, blockId, key, value));
  }

  function updatePage(page: AdminLessonPageRow) {
    setPages((current) => current.map((item) => (item.id === page.id ? page : item)));
  }

  function reorderPage(pageId: string, direction: "up" | "down") {
    setPages((current) => swapPageOrder(current, pageId, direction));
  }

  function reorderBlock(blockId: string, direction: "up" | "down") {
    setBlocks((current) => swapBlockOrder(current, blockId, direction));
  }

  function removeBlock(block: DraftBlock) {
    if (block.isDraft) {
      setBlocks((current) => current.filter((item) => item.id !== block.id));
      return;
    }

    const shouldRemove = window.confirm("Remove this content block from the lesson page?");
    if (!shouldRemove) return;

    setBlocks((current) => current.filter((item) => item.id !== block.id));
    void fetch("/api/admin/learning/blocks", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        pageId: block.page_id,
        blockId: block.id,
      }),
    })
      .then((response) => {
        if (!response.ok) {
          window.alert("The block could not be removed. Refresh the page to restore the latest version.");
          router.refresh();
        }
      })
      .catch(() => {
        window.alert("The block could not be removed. Refresh the page to restore the latest version.");
        router.refresh();
      });
  }

  return (
    <section className="mt-6 grid gap-4 xl:grid-cols-[18rem_1fr_25rem]">
      <div className="h-fit rounded-[18px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] p-5 shadow-sm">
        <h2 className="text-lg font-black">Pages</h2>
        <p className="mt-1 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
          Pick a page to edit and preview. Use the arrows to change page order.
        </p>
        {sortedPages.length === 0 ? (
          <div className="mt-4">
            <EmptyAdminState>No pages yet.</EmptyAdminState>
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {sortedPages.map((page, index) => (
              <div
                className={`rounded-[16px] border p-3 transition ${
                  selectedPage?.id === page.id
                    ? "border-[var(--ve-green)] bg-[color:color-mix(in_srgb,var(--ve-green-soft)_82%,var(--ve-card))]"
                    : "border-[var(--ve-line-soft)] bg-[var(--ve-card)] hover:bg-[var(--ve-shell)]"
                }`}
                key={page.id}
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    className="text-left text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-green)]"
                    onClick={() => setSelectedPageId(page.id)}
                    type="button"
                  >
                    Page {index + 1}
                  </button>
                  <ReorderPageButtons
                    isFirst={index === 0}
                    isLast={index === sortedPages.length - 1}
                    lessonId={lesson.id}
                    onReorder={reorderPage}
                    pageId={page.id}
                  />
                </div>
                <button
                  className="mt-2 block w-full text-left"
                  onClick={() => setSelectedPageId(page.id)}
                  type="button"
                >
                  <h3 className="line-clamp-2 text-sm font-black">{page.title}</h3>
                  <p className="mt-1 text-[11px] font-bold capitalize text-[var(--ve-muted)]">
                    {page.page_type} · {blocks.filter((block) => block.page_id === page.id).length} blocks
                  </p>
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 border-t border-[var(--ve-line-soft)] pt-5">
          <h2 className="mb-1 text-base font-black">Add page</h2>
          <p className="mb-4 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
            Adds a blank page at the end. Edit details in Page settings.
          </p>
          <AddPageButton onAddPage={addDraftPage} />
        </div>
      </div>

      <div className="rounded-[18px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] p-5 shadow-sm">
        {selectedPage ? (
          <>
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-green)]">
                  Page builder
                </p>
                <h2 className="mt-1 text-xl font-black">{selectedPage.title}</h2>
                {selectedPage.subtitle ? (
                  <p className="mt-1 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
                    {selectedPage.subtitle}
                  </p>
                ) : null}
                <p className="mt-2 text-xs font-bold text-[var(--ve-muted)]">
                  {autosaveState === "saving" && "Saving changes..."}
                  {autosaveState === "dirty" && `Autosaving in ${Math.round(AUTOSAVE_DELAY_MS / 1000)}s.`}
                  {autosaveState === "saved" &&
                    (lastSavedAt
                      ? `Saved at ${new Date(lastSavedAt).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })}.`
                      : "All changes saved.")}
                  {autosaveState === "error" && autosaveMessage}
                  {autosaveState === "idle" && "Autosaves after you stop editing."}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <AdminStatusBadge>{selectedPageBlocks.length} blocks</AdminStatusBadge>
                <button
                  className="rounded-[12px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] px-3 py-2 text-xs font-black transition hover:border-[var(--ve-green)] hover:text-[var(--ve-green)] disabled:opacity-60"
                  disabled={autosaveState === "saving"}
                  onClick={() => {
                    void saveBuilderSnapshot(true);
                  }}
                  type="button"
                >
                  {autosaveState === "saving" ? "Saving..." : "Save now"}
                </button>
              </div>
            </div>

            <details className="rounded-[18px] border border-[var(--ve-line-soft)] bg-[var(--ve-shell)] p-4">
              <summary className="cursor-pointer text-sm font-black">Page settings</summary>
              <div className="mt-4">
                <PageSettingsEditor
                  onChange={updatePage}
                  onSaveNow={() => {
                    void saveBuilderSnapshot(true);
                  }}
                  page={selectedPage}
                  isSaving={autosaveState === "saving"}
                />
              </div>
            </details>

            <div className="mt-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-black">Add content</h3>
                <p className="text-xs font-bold text-[var(--ve-muted)]">Toolbar adds locally first</p>
              </div>
              <div className="flex flex-wrap gap-2 rounded-[18px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] p-2">
                {blockToolbarItems.map((item) => (
                  <button
                    className="rounded-[12px] bg-[var(--ve-panel)] px-3 py-2 text-xs font-black transition hover:bg-[color:color-mix(in_srgb,var(--ve-green-soft)_76%,var(--ve-panel))] hover:text-[var(--ve-green)]"
                    key={item.type}
                    onClick={() => addDraftBlock(item.type)}
                    type="button"
                  >
                    + {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {selectedPageBlocks.length === 0 ? (
                <EmptyAdminState>No blocks on this page yet.</EmptyAdminState>
              ) : (
                selectedPageBlocks.map((block, index) => (
                  <BlockEditor
                    block={block}
                    isFirst={index === 0}
                    isLast={index === selectedPageBlocks.length - 1}
                    key={block.id}
                    onRemove={removeBlock}
                    onPayloadChange={(key, value) => updateBlock(block.id, key, value)}
                    onReorder={reorderBlock}
                    onSaveNow={() => {
                      void saveBuilderSnapshot(true);
                    }}
                    isSaving={autosaveState === "saving"}
                  />
                ))
              )}
            </div>
          </>
        ) : (
          <EmptyAdminState>Create a page before adding content blocks.</EmptyAdminState>
        )}
      </div>

      <div className="h-fit rounded-[18px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] p-5 shadow-sm xl:sticky xl:top-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-green)]">
              Live preview
            </p>
            <h2 className="mt-1 text-lg font-black">Learner page</h2>
          </div>
          {selectedPage ? (
            <Link className="text-xs font-black text-[var(--ve-green)]" href={`/lessons/${lesson.id}?page=${selectedPage.page_number}`}>
              Open
            </Link>
          ) : null}
        </div>
        <div className="mx-auto max-w-[23rem] overflow-hidden rounded-[30px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] shadow-sm">
          <div className="flex items-center justify-between border-b border-[var(--ve-line-soft)] px-5 py-4">
            <span className="text-[var(--foreground)]">
              <ArrowLeftIcon className="h-5 w-5" />
            </span>
            <p className="line-clamp-1 text-sm font-black">{lesson.title}</p>
            <span className="text-[var(--foreground)]">
              <MenuIcon className="h-5 w-5" />
            </span>
          </div>
          {selectedPage ? (
            <div className="p-5">
              <LessonPageLayout
                blocks={selectedPreviewBlocks}
                coverImage={pageCoverImage}
                isPreview
                pageType={selectedPage.page_type}
                subtitle={selectedPage.subtitle}
                title={selectedPage.title}
              />
            </div>
          ) : (
            <div className="px-5 py-12 text-center text-xs font-bold text-[var(--ve-muted)]">
              Create a page to see the learner preview.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
