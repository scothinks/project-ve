"use client";

import { mediaGenerationBrief, type MediaBriefContext } from "./media-generation-brief";
import { isEmptyMediaPlaceholder, mediaIntent } from "@/lib/media-intent";

import { MediaAudio, MediaVideo } from "@/components/media/MediaPlayback";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  type DragEndEvent,
  type DraggableAttributes,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DraggableSyntheticListeners } from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import dynamic from "next/dynamic";
import Image from "@/components/media/MediaImage";
import { useEffect, useState } from "react";
import { AdminDragHandle } from "@/components/admin/AdminDragHandle";
import { AdminDesignIcon } from "@/components/admin/AdminIcons";
import { AdminSelect } from "@/components/admin/AdminSelect";
import { useMediaPicker } from "@/components/admin/MediaPickerProvider";
import type { RichTextBlockEditorProps } from "@/components/admin/RichTextBlockEditor";
import { RichTextEditorLoading } from "@/components/admin/RichTextEditorLoading";
import { getImageFitClass, getImagePresentationStyle } from "@/lib/image-presentation";
import { cn } from "@/lib/utils";
import type {
  AdminLearningMediaAssetRow,
  AdminLessonPageRow,
} from "@/lib/admin";
import {
  getImageValue,
  type DraftBlock,
  type ReorderDirection,
} from "@/features/learning/admin/lesson-page-builder-domain";

export type AutosaveState = "idle" | "dirty" | "saving" | "saved" | "error";

const RichTextBlockEditor = dynamic<RichTextBlockEditorProps>(
  () => import("@/components/admin/RichTextBlockEditor").then((module) => module.RichTextBlockEditor),
  {
    ssr: false,
    loading: RichTextEditorLoading,
  },
);

const blockToolbarItems = [
  { type: "text", label: "Text" },
  { type: "callout", label: "Callout" },
  { type: "image", label: "Image" },
  { type: "gif", label: "GIF" },
  { type: "video", label: "Video" },
  { type: "audio", label: "Audio" },
  { type: "table", label: "Table" },
];

function blockKindLabel(block: DraftBlock) {
  if (block.block_type === "image" && block.payload?.mediaKind === "gif") {
    return "GIF";
  }

  return block.block_type.replaceAll("_", " ");
}

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
      ? "bg-[color:color-mix(in_srgb,var(--ui-danger-bg)_82%,var(--ui-surface))] text-[var(--ui-danger)] hover:bg-[color:color-mix(in_srgb,var(--ui-danger-bg)_92%,var(--ui-surface))]"
      : "bg-[var(--ui-surface-soft)] text-[var(--ui-text)] hover:bg-[color:color-mix(in_srgb,var(--ui-action-soft)_76%,var(--ui-surface-soft))] hover:text-[var(--ui-action)]";

  return `inline-flex h-8 w-8 items-center justify-center rounded-full ${toneClasses} transition disabled:cursor-not-allowed disabled:opacity-35`;
}

function compactFieldClasses() {
  return "mt-2 w-full rounded-[12px] border border-[var(--ui-control-border)] bg-[var(--ui-surface)] px-3 py-2 text-sm font-bold outline-none transition focus:border-[var(--ui-focus)] focus:ring-4 focus:ring-[var(--ui-focus)]";
}

function labelClasses() {
  return "text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ui-text-muted)]";
}

function BlockActionButtons({
  block,
  isFirst,
  isLast,
  onDuplicate,
  onReorder,
  onRemove,
}: {
  block: DraftBlock;
  isFirst: boolean;
  isLast: boolean;
  onDuplicate: (block: DraftBlock) => void;
  onReorder: (blockId: string, direction: ReorderDirection) => void;
  onRemove: (block: DraftBlock) => void;
}) {
  if (block.isDraft) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-[var(--ui-text-muted)]">Unsaved</span>
        <button
          aria-label="Duplicate draft block"
          className={actionButtonClasses()}
          onClick={() => onDuplicate(block)}
          title="Duplicate block"
          type="button"
        >
          +
        </button>
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

  return (
    <div className="flex gap-1">
      <button
        aria-label="Move block earlier"
        className={actionButtonClasses()}
        disabled={isFirst}
        onClick={() => onReorder(block.id, "up")}
        title="Move earlier"
        type="button"
      >
        <ArrowUpIcon />
      </button>
      <button
        aria-label="Move block later"
        className={actionButtonClasses()}
        disabled={isLast}
        onClick={() => onReorder(block.id, "down")}
        title="Move later"
        type="button"
      >
        <ArrowDownIcon />
      </button>
      <button
        aria-label="Duplicate block"
        className={actionButtonClasses()}
        onClick={() => onDuplicate(block)}
        title="Duplicate block"
        type="button"
      >
        +
      </button>
      <button
        aria-label="Remove block"
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

function PageSettingsEditor({
  aiGenerationAvailable = true,
  mediaLibraryAssets,
  page,
  onChange,
}: {
  aiGenerationAvailable?: boolean;
  mediaLibraryAssets: AdminLearningMediaAssetRow[];
  page: AdminLessonPageRow;
  onChange: (page: AdminLessonPageRow) => void;
}) {
  const coverImage = page.cover_image ?? {};
  const coverUrl = getImageValue(coverImage, "src");
  const coverAlt = getImageValue(coverImage, "alt");
  const { requestMedia } = useMediaPicker();

  async function pickCover() {
    const picked = await requestMedia({
      aiGenerationAvailable,
      assetTypeFilter: ["cover", "image", "infographic", "thumbnail"],
      caption: String(coverImage.caption ?? ""),
      initialAltText: coverAlt,
      initialFit: String(coverImage.fit ?? "cover"),
      initialPositionX: Number(coverImage.positionX ?? 50),
      initialPositionY: Number(coverImage.positionY ?? 50),
      initialUrl: coverUrl,
      libraryAssets: mediaLibraryAssets,
      imageTarget: { target: "page_cover", targetId: page.id },
      placementLabel: "Page cover",
      title: "Choose a page cover",
      uploadContext: {
        assetType: "cover",
        lessonId: page.lesson_id,
        placement: "page_cover",
      },
    });

    if (!picked || picked.alreadyApplied) return;

    onChange({
      ...page,
      cover_image: {
        ...coverImage,
        alt: picked.altText,
        caption: picked.caption,
        fit: picked.fit,
        positionX: picked.positionX,
        positionY: picked.positionY,
        src: picked.url,
      },
    });
  }

  return (
    <div className="space-y-4">
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
          <AdminSelect
            className="mt-2"
            onValueChange={(nextType) => onChange({ ...page, page_type: nextType })}
            options={[
              { label: "Primer", value: "primer" },
              { label: "Concept", value: "concept" },
              { label: "Example", value: "example" },
              { label: "Reflection", value: "reflection" },
              { label: "Summary", value: "summary" },
            ]}
            size="compact"
            value={page.page_type}
          />
        </label>
      </div>
      <div>
        <span className={labelClasses()}>Page cover</span>
        <p className="mt-1 text-xs font-semibold text-[var(--ui-text-muted)]">
          Optional — shown above this page&apos;s content. The first page falls back to the lesson cover if empty.
        </p>
        <button
          className="relative mt-2 block h-32 w-full overflow-hidden rounded-[14px] text-left"
          onClick={() => {
            void pickCover();
          }}
          type="button"
        >
          {coverUrl ? (
            <>
              <Image
                alt={coverAlt}
                className={getImageFitClass(coverImage)}
                fill
                sizes="600px"
                src={coverUrl}
                style={getImagePresentationStyle(coverImage)}
              />
              <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/55 to-transparent p-3">
                <span className="text-xs font-bold text-white/90">Page cover &middot; click to change</span>
              </div>
            </>
          ) : (
            <div className="flex h-full w-full items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-dashed border-[var(--ui-border-subtle)] bg-[var(--ui-surface-soft)] text-[var(--ui-border)]">
              <AdminDesignIcon className="h-5 w-5" />
              <span className="text-xs font-bold">Add a page cover</span>
            </div>
          )}
        </button>
      </div>
    </div>
  );
}

const calloutVariants: Array<{ value: string; label: string }> = [
  { value: "key_point", label: "Key point" },
  { value: "tip", label: "Tip" },
  { value: "warning", label: "Warning" },
  { value: "example", label: "Example" },
];

function pillToggleClasses(active: boolean) {
  return cn(
    "rounded-full border px-3 py-1.5 text-xs font-extrabold transition",
    active
      ? "border-[var(--ui-action)] bg-[var(--ui-action)] text-[var(--ui-on-action)]"
      : "border-[var(--ui-border-subtle)] bg-[var(--ui-surface)] text-[var(--ui-text)] hover:border-[var(--ui-action)]",
  );
}

function underlineFieldClasses() {
  return "w-full border-0 border-b border-[var(--ui-control-border)] bg-transparent px-0.5 py-1.5 text-sm font-semibold text-[var(--ui-text)] outline-none focus:border-[var(--ui-focus)]";
}

function BlockCardShell({
  block,
  children,
  dragAttributes,
  dragListeners,
  isFirst,
  isLast,
  isSelected,
  kindLabel,
  onDuplicate,
  onRemove,
  onReorder,
  onSelect,
}: {
  block: DraftBlock;
  children: React.ReactNode;
  dragAttributes: DraggableAttributes;
  dragListeners: DraggableSyntheticListeners;
  isFirst: boolean;
  isLast: boolean;
  isSelected: boolean;
  kindLabel: string;
  onDuplicate: (block: DraftBlock) => void;
  onRemove: (block: DraftBlock) => void;
  onReorder: (blockId: string, direction: ReorderDirection) => void;
  onSelect: (blockId: string) => void;
}) {
  return (
    <div
      className={cn(
        "space-y-2.5 rounded-[16px] border bg-[var(--ui-surface)] p-4",
        isSelected ? "border-[var(--ui-current-text)]" : "border-[var(--ui-border-subtle)]",
      )}
      id={`block-${block.id}`}
      onFocus={() => onSelect(block.id)}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <AdminDragHandle attributes={dragAttributes} className="h-6 w-6" label={`${kindLabel} block`} listeners={dragListeners} />
          <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[var(--ui-border)]">
            {kindLabel} block
          </span>
        </div>
        <BlockActionButtons
          block={block}
          isFirst={isFirst}
          isLast={isLast}
          onDuplicate={onDuplicate}
          onRemove={onRemove}
          onReorder={onReorder}
        />
      </div>
      {children}
    </div>
  );
}

type MediaChooserKind = "image" | "gif" | "video" | "audio";

const mediaChooserLabel: Record<MediaChooserKind, string> = {
  audio: "Audio",
  gif: "GIF",
  image: "Image",
  video: "Video",
};

function MediaBlockChooser({
  kind,
  onOpen,
  src,
}: {
  kind: MediaChooserKind;
  onOpen: () => void;
  src: string;
}) {
  const [interactive, setInteractive] = useState(false);
  useEffect(() => setInteractive(true), []);
  const hasMedia = src.trim().length > 0;
  const label = mediaChooserLabel[kind];

  if (hasMedia && kind === "video") {
    return (
      <div className="space-y-2">
        <MediaVideo className="w-full rounded-[14px] border border-[var(--ui-border-subtle)] bg-black" controls src={src} />
        <button disabled={!interactive} className="text-xs font-extrabold text-[var(--ui-action)]" onClick={onOpen} type="button">
          Change video
        </button>
      </div>
    );
  }

  if (hasMedia && kind === "audio") {
    return (
      <div className="flex items-center gap-3 rounded-[14px] border border-[var(--ui-border-subtle)] bg-[var(--ui-surface-soft)] p-3.5">
        <MediaAudio className="min-w-0 flex-1" controls src={src} />
        <button disabled={!interactive} className="shrink-0 text-xs font-extrabold text-[var(--ui-action)]" onClick={onOpen} type="button">
          Change
        </button>
      </div>
    );
  }

  return (
    <button
      disabled={!interactive}
      className={`relative flex ${kind === "video" ? "aspect-video" : "min-h-[140px]"} w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-[14px] border border-dashed border-[var(--ui-border-subtle)] bg-[var(--ui-surface-soft)] text-[var(--ui-border)] transition hover:border-[var(--ui-action)] hover:text-[var(--ui-action)]`}
      onClick={onOpen}
      type="button"
    >
      {hasMedia ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="" className="absolute inset-0 h-full w-full object-cover" src={src} />
          <span className="relative z-10 rounded-full bg-black/55 px-3 py-1.5 text-xs font-bold text-white">
            {label} set · click to change
          </span>
        </>
      ) : (
        <>
          {blockTypeIcon(kind)}
          <span className="text-xs font-bold">Add {kind === "audio" ? "audio" : `${kind === "image" ? "an" : "a"} ${label.toLowerCase()}`}</span>
        </>
      )}
    </button>
  );
}

function TableGridEditor({
  columns,
  onPayloadChange,
  rows,
}: {
  columns: string[];
  onPayloadChange: (key: string, value: unknown) => void;
  rows: string[][];
}) {
  function updateColumnLabel(columnIndex: number, value: string) {
    onPayloadChange("columns", columns.map((column, index) => (index === columnIndex ? value : column)));
  }

  function addColumn() {
    onPayloadChange("columns", [...columns, `Column ${columns.length + 1}`]);
    onPayloadChange("rows", rows.map((row) => [...row, ""]));
  }

  function removeColumn(columnIndex: number) {
    onPayloadChange("columns", columns.filter((_, index) => index !== columnIndex));
    onPayloadChange("rows", rows.map((row) => row.filter((_, index) => index !== columnIndex)));
  }

  function updateCell(rowIndex: number, columnIndex: number, value: string) {
    onPayloadChange(
      "rows",
      rows.map((row, index) => (index === rowIndex ? row.map((cell, cellIndex) => (cellIndex === columnIndex ? value : cell)) : row)),
    );
  }

  function addRow() {
    onPayloadChange("rows", [...rows, columns.map(() => "")]);
  }

  function removeRow(rowIndex: number) {
    onPayloadChange("rows", rows.filter((_, index) => index !== rowIndex));
  }

  return (
    <div className="space-y-2.5">
      <div className="overflow-x-auto rounded-[12px] border border-[var(--ui-border-subtle)]">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[var(--ui-surface-soft)]">
              {columns.map((column, columnIndex) => (
                <th className="border-b border-r border-[var(--ui-border-subtle)] p-0 text-left last:border-r-0" key={columnIndex}>
                  <div className="flex items-center gap-1 px-2.5 py-2">
                    <input
                      className="min-w-0 flex-1 bg-transparent text-xs font-extrabold uppercase tracking-[0.04em] text-[var(--ui-text)] outline-none"
                      onChange={(event) => updateColumnLabel(columnIndex, event.target.value)}
                      value={column}
                    />
                    <button
                      aria-label="Remove column"
                      className="shrink-0 text-[var(--ui-border)] hover:text-[var(--ui-danger)]"
                      onClick={() => removeColumn(columnIndex)}
                      type="button"
                    >
                      <svg aria-hidden="true" className="h-3 w-3" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.4" viewBox="0 0 24 24">
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </th>
              ))}
              <th className="p-2">
                <button className="text-xs font-extrabold text-[var(--ui-action)]" onClick={addColumn} type="button">
                  + Column
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr className="border-t border-[var(--ui-border-subtle)]" key={rowIndex}>
                {columns.map((_, columnIndex) => (
                  <td className="border-r border-[var(--ui-border-subtle)] p-0 last:border-r-0" key={columnIndex}>
                    <input
                      className="w-full bg-transparent px-2.5 py-2 text-sm font-medium text-[var(--ui-text)] outline-none"
                      onChange={(event) => updateCell(rowIndex, columnIndex, event.target.value)}
                      value={row[columnIndex] ?? ""}
                    />
                  </td>
                ))}
                <td className="p-2">
                  <button
                    aria-label="Remove row"
                    className="text-[var(--ui-border)] hover:text-[var(--ui-danger)]"
                    onClick={() => removeRow(rowIndex)}
                    type="button"
                  >
                    <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.4" viewBox="0 0 24 24">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="text-xs font-extrabold text-[var(--ui-action)]" onClick={addRow} type="button">
        + Add row
      </button>
    </div>
  );
}

function BlockEditor({
  aiGenerationAvailable = true,
  block,
  dragAttributes,
  dragListeners,
  isFirst,
  isLast,
  isSelected,
  lessonId,
  mediaBriefContext,
  mediaLibraryAssets,
  onDuplicate,
  onPayloadChange,
  onReorder,
  onRemove,
  onSelect,
  isSaving,
}: {
  aiGenerationAvailable?: boolean;
  block: DraftBlock;
  dragAttributes: DraggableAttributes;
  dragListeners: DraggableSyntheticListeners;
  isFirst: boolean;
  isLast: boolean;
  isSelected: boolean;
  lessonId: string;
  mediaBriefContext: MediaBriefContext;
  mediaLibraryAssets: AdminLearningMediaAssetRow[];
  onDuplicate: (block: DraftBlock) => void;
  onPayloadChange: (key: string, value: unknown) => void;
  onReorder: (blockId: string, direction: ReorderDirection) => void;
  onRemove: (block: DraftBlock) => void;
  onSelect: (blockId: string) => void;
  isSaving: boolean;
}) {
  const { requestMedia } = useMediaPicker();
  const payload = block.payload ?? {};
  const intent = mediaIntent(payload);
  const placeholderDetails = isEmptyMediaPlaceholder(block) && intent ? <div className="rounded-xl bg-[var(--ui-surface-soft)] p-4 text-sm">
    <p className="font-bold">Optional media</p>
    <p className="mt-2 leading-6">{intent.purpose}</p>
    <p className="mt-2 text-xs">Choose media below, or leave this out. Empty optional placeholders aren’t shown to learners.</p>
  </div> : null;
  const title = String(payload.title ?? payload.heading ?? "");
  const body = String(payload.body ?? payload.transcript ?? "");
  const kindLabel = blockKindLabel(block);
  const shellProps = {
    block,
    dragAttributes,
    dragListeners,
    isFirst,
    isLast,
    isSelected,
    kindLabel,
    onDuplicate,
    onRemove,
    onReorder,
    onSelect,
  };

  if (block.block_type === "image") {
    const isGif = payload.mediaKind === "gif";
    const src = String(payload.src ?? "");

    async function pickImage() {
      const picked = await requestMedia({
        aiGenerationAvailable,
        imageTarget: block.block_type === "image" ? { target: "block", targetId: block.id } : undefined,
        onGenerationStyleChange: (style) => onPayloadChange("mediaStyle", style),
        initialGenerationBrief: mediaGenerationBrief(payload, mediaBriefContext),
        onGenerationBriefChange: (brief) => onPayloadChange("mediaBrief", brief),
        assetTypeFilter: ["cover", "image", "infographic", "thumbnail"],
        caption: String(payload.caption ?? ""),
        initialAltText: String(payload.alt ?? ""),
        initialFit: String(payload.fit ?? "cover"),
        initialPositionX: Number(payload.positionX ?? 50),
        initialPositionY: Number(payload.positionY ?? 50),
        initialUrl: src,
        isGif,
        libraryAssets: mediaLibraryAssets,
        mediaKind: "image",
        placementLabel: isGif ? "GIF block" : "Image block",
        title: isGif ? "Choose a GIF" : "Choose an image",
        uploadContext: {
          assetType: "image",
          lessonId,
          placement: "page_block",
        },
      });

      if (!picked || picked.alreadyApplied) return;

      onPayloadChange("src", picked.url);
      onPayloadChange("alt", picked.altText);
      onPayloadChange("fit", picked.fit);
      onPayloadChange("positionX", picked.positionX);
      onPayloadChange("positionY", picked.positionY);
      onPayloadChange("caption", picked.caption);
    }

    return (
      <BlockCardShell {...shellProps}>
        {typeof payload.aiManagedByAssetId === "string" && payload.aiManagedByAssetId ? (
          <div className="rounded-[12px] border border-[var(--ui-border-subtle)] bg-[var(--ui-surface-soft)] px-3 py-2 text-xs font-semibold text-[var(--ui-text-muted)]">
            This image block is linked to an AI media brief. Editing the content here keeps that link intact.
          </div>
        ) : null}
        {placeholderDetails}
        <MediaBlockChooser kind={isGif ? "gif" : "image"} onOpen={() => void pickImage()} src={src} />
        <input
          className={underlineFieldClasses()}
          onChange={(event) => onPayloadChange("caption", event.target.value)}
          placeholder="Caption (optional)"
          value={String(payload.caption ?? "")}
        />
      </BlockCardShell>
    );
  }

  if (block.block_type === "video" || block.block_type === "audio") {
    const mediaLabel = block.block_type === "video" ? "Video" : "Audio";
    const src = String(payload.src ?? "");
    const blockKind = block.block_type;

    async function pickMedia() {
      const picked = await requestMedia({
        aiGenerationAvailable,
        imageTarget: block.block_type === "image" ? { target: "block", targetId: block.id } : undefined,
        onGenerationStyleChange: (style) => onPayloadChange("mediaStyle", style),
        initialGenerationBrief: mediaGenerationBrief(payload, mediaBriefContext),
        onGenerationBriefChange: (brief) => onPayloadChange("mediaBrief", brief),
        assetTypeFilter: [blockKind],
        initialUrl: src,
        libraryAssets: mediaLibraryAssets,
        mediaKind: blockKind,
        placementLabel: `${mediaLabel} block`,
        title: blockKind === "video" ? "Choose a video" : "Choose an audio clip",
        uploadContext: {
          assetType: blockKind,
          lessonId,
          placement: "page_block",
        },
      });

      if (!picked || picked.alreadyApplied) return;

      onPayloadChange("src", picked.url);
    }

    return (
      <BlockCardShell {...shellProps}>
        <input
          className={underlineFieldClasses()}
          onChange={(event) => onPayloadChange("title", event.target.value)}
          placeholder={`${mediaLabel} title (optional)`}
          value={title}
        />
        {placeholderDetails}
        <MediaBlockChooser kind={blockKind} onOpen={() => void pickMedia()} src={src} />
        <textarea
          className="min-h-16 w-full resize-none rounded-[12px] border border-[var(--ui-control-border)] bg-[var(--ui-surface-soft)] px-3 py-2 text-sm font-semibold text-[var(--ui-text)] outline-none focus:border-[var(--ui-focus)]"
          onChange={(event) => onPayloadChange("body", event.target.value)}
          placeholder={block.block_type === "video" ? "Caption (optional)" : "Transcript (optional)"}
          value={body}
        />
      </BlockCardShell>
    );
  }

  if (block.block_type === "table") {
    const columns = Array.isArray(payload.columns) ? payload.columns.map(String) : ["Column 1", "Column 2"];
    const rows = Array.isArray(payload.rows)
      ? payload.rows.map((row) => (Array.isArray(row) ? row.map(String) : [String(row)]))
      : [];

    return (
      <BlockCardShell {...shellProps}>
        <input
          className={underlineFieldClasses()}
          onChange={(event) => onPayloadChange("title", event.target.value)}
          placeholder="Table title (optional)"
          value={title}
        />
        <TableGridEditor columns={columns} onPayloadChange={onPayloadChange} rows={rows} />
        <input
          className={underlineFieldClasses()}
          onChange={(event) => onPayloadChange("caption", event.target.value)}
          placeholder="Caption (optional)"
          value={String(payload.caption ?? "")}
        />
      </BlockCardShell>
    );
  }

  if (block.block_type === "callout") {
    return (
      <BlockCardShell {...shellProps}>
        <div className="flex flex-wrap gap-1.5">
          {calloutVariants.map((variant) => (
            <button
              className={pillToggleClasses(String(payload.variant ?? "key_point") === variant.value)}
              key={variant.value}
              onClick={() => onPayloadChange("variant", variant.value)}
              type="button"
            >
              {variant.label}
            </button>
          ))}
        </div>
        <div className="rounded-[14px] bg-[var(--ui-surface-soft)] p-3.5">
          <textarea
            className="min-h-14 w-full resize-none border-0 bg-transparent text-sm font-semibold leading-6 text-[var(--ui-text-muted)] outline-none"
            onChange={(event) => onPayloadChange("body", event.target.value)}
            placeholder="Callout text"
            value={body}
          />
        </div>
      </BlockCardShell>
    );
  }

  return (
    <BlockCardShell {...shellProps}>
      <input
        className={underlineFieldClasses()}
        onChange={(event) => onPayloadChange("heading", event.target.value)}
        placeholder="Heading (optional)"
        value={title}
      />
      <RichTextBlockEditor
        disabled={isSaving}
        onChange={(value) => onPayloadChange("body", value)}
        value={body}
      />
    </BlockCardShell>
  );
}

export function LessonBuilderPagesPanel({
  aiAuthoringControls,
  pages,
  selectedPageId,
  onSelectPage,
  onAddPage,
  onDuplicatePage,
  onRequestDeletePage,
  onReorderPageById,
}: {
  aiAuthoringControls?: React.ReactNode;
  pages: AdminLessonPageRow[];
  selectedPageId: string;
  onSelectPage: (pageId: string) => void;
  onAddPage: () => void;
  onDuplicatePage: (pageId: string) => void;
  onRequestDeletePage: (page: AdminLessonPageRow) => void;
  onReorderPageById: (activePageId: string, overPageId: string) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    onReorderPageById(String(active.id), String(over.id));
  }

  return (
    <div className="flex flex-col gap-1.5 border-r border-[var(--ui-border-subtle)] px-4 py-6">
      <p className="px-2.5 pb-2 text-[11px] font-extrabold uppercase tracking-[0.1em] text-[var(--ui-border)]">
        Pages
      </p>
      {pages.length === 0 ? (
        <p className="px-2.5 py-6 text-center text-sm font-semibold text-[var(--ui-text-muted)]">No pages yet.</p>
      ) : (
        <DndContext collisionDetection={closestCenter} id="lesson-pages-dnd" onDragEnd={handleDragEnd} sensors={sensors}>
          <SortableContext items={pages.map((page) => page.id)} strategy={verticalListSortingStrategy}>
            {pages.map((page, index) => (
              <SortablePageRow
                canDelete={pages.length > 1}
                index={index}
                isSelected={selectedPageId === page.id}
                key={page.id}
                onDuplicatePage={onDuplicatePage}
                onRequestDeletePage={onRequestDeletePage}
                onSelectPage={onSelectPage}
                page={page}
              />
            ))}
          </SortableContext>
        </DndContext>
      )}

      <button
        className="mt-1.5 flex items-center gap-2 rounded-[10px] px-2.5 py-2.5 text-[13px] font-extrabold text-[var(--ui-action)] transition hover:bg-[var(--ui-surface-soft)]"
        onClick={onAddPage}
        type="button"
      >
        <svg aria-hidden="true" className="h-[15px] w-[15px]" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.4" viewBox="0 0 24 24">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Add page
      </button>

      {aiAuthoringControls}
    </div>
  );
}

function SortablePageRow({
  canDelete,
  index,
  isSelected,
  onDuplicatePage,
  onRequestDeletePage,
  onSelectPage,
  page,
}: {
  canDelete: boolean;
  index: number;
  isSelected: boolean;
  onDuplicatePage: (pageId: string) => void;
  onRequestDeletePage: (page: AdminLessonPageRow) => void;
  onSelectPage: (pageId: string) => void;
  page: AdminLessonPageRow;
}) {
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } = useSortable({ id: page.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div className={cn("group flex items-center gap-0.5", isDragging && "opacity-80")} ref={setNodeRef} style={style}>
      <AdminDragHandle attributes={attributes} className="h-6 w-6 shrink-0" label={page.title} listeners={listeners} />
      <button
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2.5 rounded-[10px] px-2 py-2 text-left transition",
          isSelected
            ? "bg-[color:color-mix(in_srgb,var(--ui-action-soft)_70%,var(--ui-surface))]"
            : "hover:bg-[var(--ui-surface-soft)]",
        )}
        onClick={() => onSelectPage(page.id)}
        type="button"
      >
        <span
          className={cn(
            "shrink-0 text-[13px] font-extrabold",
            isSelected ? "text-[var(--ui-action)]" : "text-[var(--ui-border)]",
          )}
        >
          {index + 1}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-bold text-[var(--ui-text)]">{page.title}</span>
      </button>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          aria-label={`More actions for ${page.title}`}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[var(--ui-border)] opacity-0 transition hover:bg-[var(--ui-surface-soft)] hover:text-[var(--ui-action)] focus-visible:opacity-100 group-hover:opacity-100"
          type="button"
        >
          ⋯
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            className="z-50 min-w-44 rounded-[14px] border border-[var(--ui-border-subtle)] bg-[var(--ui-surface)] p-2 shadow-xl"
            sideOffset={6}
          >
            <DropdownMenu.Item asChild>
              <button
                className="w-full rounded-[10px] px-3 py-2 text-left text-sm font-bold outline-none hover:bg-[var(--ui-surface-soft)]"
                onClick={() => onDuplicatePage(page.id)}
                type="button"
              >
                Duplicate page
              </button>
            </DropdownMenu.Item>
            <DropdownMenu.Separator className="my-1 h-px bg-[var(--ui-border-subtle)]" />
            <DropdownMenu.Item asChild>
              <button
                className="w-full rounded-[10px] px-3 py-2 text-left text-sm font-bold text-[var(--ui-danger)] outline-none hover:bg-[var(--ui-surface-soft)] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!canDelete}
                onClick={() => onRequestDeletePage(page)}
                title={canDelete ? undefined : "A lesson needs at least one page."}
                type="button"
              >
                Delete page
              </button>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}

export function LessonBuilderEditorPanel({
  aiGenerationAvailable = true,
  allowedBlockTypes,
  selectedPage,
  lesson,
  selectedPageBlocks,
  autosaveState,
  autosaveMessage,
  lastSavedAt,
  autosaveDelayMs,
  onAddDraftBlock,
  onDuplicateBlock,
  mediaLibraryAssets,
  onUpdateBlock,
  onUpdatePage,
  onReorderBlock,
  onReorderBlockById,
  onRemoveBlock,
  onSelectBlock,
  selectedBlockId,
}: {
  aiGenerationAvailable?: boolean;
  allowedBlockTypes?: string[];
  lesson: MediaBriefContext["lesson"];
  selectedPage: AdminLessonPageRow | null;
  selectedPageBlocks: DraftBlock[];
  autosaveState: AutosaveState;
  autosaveMessage: string;
  lastSavedAt: string | null;
  autosaveDelayMs: number;
  onAddDraftBlock: (blockType: string, insertIndex?: number) => void;
  onDuplicateBlock: (block: DraftBlock) => void;
  mediaLibraryAssets: AdminLearningMediaAssetRow[];
  onUpdateBlock: (blockId: string, key: string, value: unknown) => void;
  onUpdatePage: (page: AdminLessonPageRow) => void;
  onReorderBlock: (blockId: string, direction: ReorderDirection) => void;
  onReorderBlockById: (activeBlockId: string, overBlockId: string) => void;
  onRemoveBlock: (block: DraftBlock) => void;
  onSelectBlock: (blockId: string) => void;
  selectedBlockId: string;
}) {
  const [editingPageSettings, setEditingPageSettings] = useState(false);
  const isSaving = autosaveState === "saving";
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    onReorderBlockById(String(active.id), String(over.id));
  }

  return (
    <div className="flex justify-center px-6 py-14">
      <div className="flex w-full max-w-[640px] flex-col gap-4">
        {selectedPage ? (
          <>
            <div className="flex items-center gap-2">
              <h2 className="text-[30px] font-black leading-[1.2] tracking-[-0.01em] text-[var(--ui-text)]">
                {selectedPage.title}
              </h2>
              <button
                aria-label="Edit page settings"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--ui-text-muted)] transition hover:bg-[var(--ui-surface-soft)] hover:text-[var(--ui-action)]"
                onClick={() => setEditingPageSettings((current) => !current)}
                type="button"
              >
                <AdminDesignIcon className="h-4 w-4" />
              </button>
            </div>
            {selectedPage.subtitle ? (
              <p className="-mt-2 text-xs font-semibold leading-5 text-[var(--ui-text-muted)]">
                {selectedPage.subtitle}
              </p>
            ) : null}
            <p className="-mt-2 text-xs font-bold text-[var(--ui-text-muted)]">
              {autosaveState === "saving" && "Saving changes..."}
              {autosaveState === "dirty" && `Autosaving in ${Math.round(autosaveDelayMs / 1000)}s.`}
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

            {editingPageSettings ? (
              <div className="rounded-[16px] border border-[var(--ui-border-subtle)] bg-[var(--ui-surface-soft)] p-4">
                <PageSettingsEditor
                  aiGenerationAvailable={aiGenerationAvailable}
                  mediaLibraryAssets={mediaLibraryAssets}
                  onChange={onUpdatePage}
                  page={selectedPage}
                />
              </div>
            ) : null}

            {selectedPageBlocks.length === 0 ? (
              <p className="rounded-[16px] border border-dashed border-[var(--ui-border-subtle)] py-8 text-center text-sm font-semibold text-[var(--ui-text-muted)]">No blocks on this page yet.</p>
            ) : (
              <DndContext collisionDetection={closestCenter} id="lesson-blocks-dnd" onDragEnd={handleDragEnd} sensors={sensors}>
                <SortableContext items={selectedPageBlocks.map((block) => block.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-4">
                    {selectedPageBlocks.map((block, index) => (
                      <SortableBlockCard
                        block={block}
                        isFirst={index === 0}
                        isLast={index === selectedPageBlocks.length - 1}
                        isSaving={isSaving}
                        isSelected={selectedBlockId === block.id}
                        key={block.id}
                        aiGenerationAvailable={aiGenerationAvailable}
                        lessonId={selectedPage.lesson_id}
                        mediaBriefContext={{ lesson, page: selectedPage, blocks: selectedPageBlocks }}
                        mediaLibraryAssets={mediaLibraryAssets}
                        onDuplicate={onDuplicateBlock}
                        onPayloadChange={(key, value) => onUpdateBlock(block.id, key, value)}
                        onRemove={onRemoveBlock}
                        onReorder={onReorderBlock}
                        onSelect={onSelectBlock}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}

            <AddBlockDisclosure
              allowedBlockTypes={allowedBlockTypes}
              insertIndex={selectedPageBlocks.length}
              onAddDraftBlock={onAddDraftBlock}
            />
          </>
        ) : (
          <p className="py-10 text-center text-sm font-semibold text-[var(--ui-text-muted)]">Create a page before adding content blocks.</p>
        )}
      </div>
    </div>
  );
}

function blockTypeIcon(type: string) {
  switch (type) {
    case "image":
      return (
        <svg aria-hidden="true" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <rect height="14" rx="2" width="18" x="3" y="5" />
          <circle cx="9" cy="10" r="1.5" />
          <path d="m21 16-5-4-4 3-3-2-6 5" />
        </svg>
      );
    case "gif":
      return (
        <svg aria-hidden="true" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <rect height="14" rx="2" width="18" x="3" y="5" />
          <path d="M7 10v4M12 10v4M17 10.5c-.8-.5-2-.5-2 .8v1.4c0 1.3 1.2 1.3 2 .8" />
        </svg>
      );
    case "callout":
      return (
        <svg aria-hidden="true" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v5M12 16h.01" />
        </svg>
      );
    case "video":
      return (
        <svg aria-hidden="true" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <rect height="14" rx="2" width="14" x="3" y="5" />
          <path d="m17 9 4-2v10l-4-2" />
        </svg>
      );
    case "audio":
      return (
        <svg aria-hidden="true" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <path d="M3 12h3l3-6 3 12 3-9 3 6h3" />
        </svg>
      );
    case "table":
      return (
        <svg aria-hidden="true" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <rect height="18" rx="2" width="18" x="3" y="3" />
          <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
        </svg>
      );
    default:
      return (
        <svg aria-hidden="true" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <path d="M4 6h16M4 12h16M4 18h10" />
        </svg>
      );
  }
}

function AddBlockDisclosure({
  allowedBlockTypes,
  insertIndex,
  onAddDraftBlock,
}: {
  allowedBlockTypes?: string[];
  insertIndex: number;
  onAddDraftBlock: (blockType: string, insertIndex?: number) => void;
}) {
  const [open, setOpen] = useState(false);
  // A GIF is stored as an image block, so its availability follows the
  // "image" entitlement rather than needing its own allow-list entry.
  const availableItems = allowedBlockTypes
    ? blockToolbarItems.filter((item) => allowedBlockTypes.includes(item.type === "gif" ? "image" : item.type))
    : blockToolbarItems;

  if (!open) {
    return (
      <button
        className="flex items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-dashed border-[var(--ui-border-subtle)] p-3.5 text-[13px] font-bold text-[var(--ui-border)] transition hover:border-[var(--ui-action)] hover:text-[var(--ui-action)]"
        onClick={() => setOpen(true)}
        type="button"
      >
        <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.4" viewBox="0 0 24 24">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Add a block
      </button>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {availableItems.map((item) => (
        <button
          className="flex flex-col items-center gap-1.5 rounded-[14px] border border-[var(--ui-border-subtle)] bg-[var(--ui-surface)] p-3.5 text-xs font-extrabold text-[var(--ui-text)] transition hover:border-[var(--ui-action)] hover:text-[var(--ui-action)]"
          key={item.type}
          onClick={() => {
            onAddDraftBlock(item.type, insertIndex);
            setOpen(false);
          }}
          type="button"
        >
          {blockTypeIcon(item.type)}
          {item.label}
        </button>
      ))}
    </div>
  );
}

function SortableBlockCard({
  aiGenerationAvailable = true,
  block,
  isFirst,
  isLast,
  isSaving,
  isSelected,
  lessonId,
  mediaBriefContext,
  mediaLibraryAssets,
  onDuplicate,
  onPayloadChange,
  onRemove,
  onReorder,
  onSelect,
}: {
  aiGenerationAvailable?: boolean;
  block: DraftBlock;
  isFirst: boolean;
  isLast: boolean;
  isSaving: boolean;
  isSelected: boolean;
  lessonId: string;
  mediaBriefContext: MediaBriefContext;
  mediaLibraryAssets: AdminLearningMediaAssetRow[];
  onDuplicate: (block: DraftBlock) => void;
  onPayloadChange: (key: string, value: unknown) => void;
  onRemove: (block: DraftBlock) => void;
  onReorder: (blockId: string, direction: ReorderDirection) => void;
  onSelect: (blockId: string) => void;
}) {
  const {
    attributes,
    isDragging,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: block.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div className={isDragging ? "opacity-80" : undefined} ref={setNodeRef} style={style}>
      <BlockEditor
        aiGenerationAvailable={aiGenerationAvailable}
        block={block}
        dragAttributes={attributes}
        dragListeners={listeners}
        isFirst={isFirst}
        isLast={isLast}
        isSaving={isSaving}
        isSelected={isSelected}
        lessonId={lessonId}
        mediaBriefContext={mediaBriefContext}
        mediaLibraryAssets={mediaLibraryAssets}
        onDuplicate={onDuplicate}
        onPayloadChange={onPayloadChange}
        onRemove={onRemove}
        onReorder={onReorder}
        onSelect={onSelect}
      />
    </div>
  );
}
