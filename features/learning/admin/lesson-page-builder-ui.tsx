"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { EmptyAdminState, AdminStatusBadge } from "@/components/admin/AdminPrimitives";
import { LessonPageLayout } from "@/components/lesson/LessonPageLayout";
import { ArrowLeftIcon, MenuIcon } from "@/components/ui/Icons";
import type {
  AdminLessonPageRow,
  AdminLessonRow,
} from "@/lib/admin";
import type { ImageAsset, LessonContentBlock } from "@/lib/lessons";
import {
  blockSummary,
  getImageValue,
  isDraftId,
  type DraftBlock,
  type ReorderDirection,
} from "@/features/learning/admin/lesson-page-builder-domain";

export type AutosaveState = "idle" | "dirty" | "saving" | "saved" | "error";

const blockToolbarItems = [
  { type: "text", label: "Text" },
  { type: "callout", label: "Callout" },
  { type: "image", label: "Image" },
  { type: "video", label: "Video" },
  { type: "audio", label: "Audio" },
  { type: "table", label: "Table" },
];

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
  onReorder: (pageId: string, direction: ReorderDirection) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function reorder(direction: ReorderDirection) {
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
  onReorder: (blockId: string, direction: ReorderDirection) => void;
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

  function reorder(direction: ReorderDirection) {
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
  onReorder: (blockId: string, direction: ReorderDirection) => void;
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

export function LessonBuilderPagesPanel({
  lessonId,
  pages,
  blocks,
  selectedPageId,
  onSelectPage,
  onAddPage,
  onReorderPage,
}: {
  lessonId: string;
  pages: AdminLessonPageRow[];
  blocks: DraftBlock[];
  selectedPageId: string;
  onSelectPage: (pageId: string) => void;
  onAddPage: () => void;
  onReorderPage: (pageId: string, direction: ReorderDirection) => void;
}) {
  return (
    <div className="h-fit rounded-[18px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] p-5 shadow-sm">
      <h2 className="text-lg font-black">Pages</h2>
      <p className="mt-1 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
        Pick a page to edit and preview. Use the arrows to change page order.
      </p>
      {pages.length === 0 ? (
        <div className="mt-4">
          <EmptyAdminState>No pages yet.</EmptyAdminState>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {pages.map((page, index) => (
            <div
              className={`rounded-[16px] border p-3 transition ${
                selectedPageId === page.id
                  ? "border-[var(--ve-green)] bg-[color:color-mix(in_srgb,var(--ve-green-soft)_82%,var(--ve-card))]"
                  : "border-[var(--ve-line-soft)] bg-[var(--ve-card)] hover:bg-[var(--ve-shell)]"
              }`}
              key={page.id}
            >
              <div className="flex items-start justify-between gap-2">
                <button
                  className="text-left text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-green)]"
                  onClick={() => onSelectPage(page.id)}
                  type="button"
                >
                  Page {index + 1}
                </button>
                <ReorderPageButtons
                  isFirst={index === 0}
                  isLast={index === pages.length - 1}
                  lessonId={lessonId}
                  onReorder={onReorderPage}
                  pageId={page.id}
                />
              </div>
              <button
                className="mt-2 block w-full text-left"
                onClick={() => onSelectPage(page.id)}
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
        <AddPageButton onAddPage={onAddPage} />
      </div>
    </div>
  );
}

export function LessonBuilderEditorPanel({
  selectedPage,
  selectedPageBlocks,
  autosaveState,
  autosaveMessage,
  lastSavedAt,
  autosaveDelayMs,
  onSaveNow,
  onUpdatePage,
  onAddDraftBlock,
  onUpdateBlock,
  onReorderBlock,
  onRemoveBlock,
}: {
  selectedPage: AdminLessonPageRow | null;
  selectedPageBlocks: DraftBlock[];
  autosaveState: AutosaveState;
  autosaveMessage: string;
  lastSavedAt: string | null;
  autosaveDelayMs: number;
  onSaveNow: () => void;
  onUpdatePage: (page: AdminLessonPageRow) => void;
  onAddDraftBlock: (blockType: string) => void;
  onUpdateBlock: (blockId: string, key: string, value: unknown) => void;
  onReorderBlock: (blockId: string, direction: ReorderDirection) => void;
  onRemoveBlock: (block: DraftBlock) => void;
}) {
  const isSaving = autosaveState === "saving";

  return (
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
            </div>
            <div className="flex items-center gap-2">
              <AdminStatusBadge>{selectedPageBlocks.length} blocks</AdminStatusBadge>
              <button
                className="rounded-[12px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] px-3 py-2 text-xs font-black transition hover:border-[var(--ve-green)] hover:text-[var(--ve-green)] disabled:opacity-60"
                disabled={isSaving}
                onClick={onSaveNow}
                type="button"
              >
                {isSaving ? "Saving..." : "Save now"}
              </button>
            </div>
          </div>

          <details className="rounded-[18px] border border-[var(--ve-line-soft)] bg-[var(--ve-shell)] p-4">
            <summary className="cursor-pointer text-sm font-black">Page settings</summary>
            <div className="mt-4">
              <PageSettingsEditor
                onChange={onUpdatePage}
                onSaveNow={onSaveNow}
                page={selectedPage}
                isSaving={isSaving}
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
                  onClick={() => onAddDraftBlock(item.type)}
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
                  onRemove={onRemoveBlock}
                  onPayloadChange={(key, value) => onUpdateBlock(block.id, key, value)}
                  onReorder={onReorderBlock}
                  onSaveNow={onSaveNow}
                  isSaving={isSaving}
                />
              ))
            )}
          </div>
        </>
      ) : (
        <EmptyAdminState>Create a page before adding content blocks.</EmptyAdminState>
      )}
    </div>
  );
}

export function LessonBuilderPreviewPanel({
  lesson,
  selectedPage,
  selectedPreviewBlocks,
  pageCoverImage,
}: {
  lesson: AdminLessonRow;
  selectedPage: AdminLessonPageRow | null;
  selectedPreviewBlocks: LessonContentBlock[];
  pageCoverImage: ImageAsset | null;
}) {
  return (
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
  );
}
