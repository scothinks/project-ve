"use client";

import * as AlertDialog from "@radix-ui/react-alert-dialog";
import * as Toast from "@radix-ui/react-toast";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  AdminLearningMediaAssetRow,
  AdminLessonBlockRow,
  AdminLessonPageRow,
  AdminLessonRow,
} from "@/lib/admin";
import {
  createBuilderSnapshotKey,
  createDraftId,
  insertBlockAtPosition,
  mapPreviewBlock,
  mergeDraftBlocks,
  mergeDraftPages,
  reconcileBuilderStateFromSave,
  reorderBlocksById,
  reorderPagesById,
  swapBlockOrder,
  swapPageOrder,
  toPreviewImageAsset,
  updateBlockPayload,
  type BuilderDraftSnapshot,
  type BuilderSaveResponse,
  type DraftBlock,
  type ReorderDirection,
} from "@/features/learning/admin/lesson-page-builder-domain";
import {
  LessonBuilderEditorPanel,
  LessonBuilderInspectorPanel,
  LessonBuilderPagesPanel,
  type AutosaveState,
} from "@/features/learning/admin/lesson-page-builder-ui";

type LessonPageBuilderProps = {
  blocks: AdminLessonBlockRow[];
  initialPageId?: string;
  lesson: AdminLessonRow;
  mediaLibraryAssets?: AdminLearningMediaAssetRow[];
  pages: AdminLessonPageRow[];
};

const AUTOSAVE_DELAY_MS = 15_000;

export function LessonPageBuilder({
  lesson,
  pages: initialPages,
  blocks: initialBlocks,
  initialPageId,
  mediaLibraryAssets = [],
}: LessonPageBuilderProps) {
  const router = useRouter();
  const [pages, setPages] = useState(initialPages);
  const [blocks, setBlocks] = useState<DraftBlock[]>(initialBlocks);
  const [selectedPageId, setSelectedPageId] = useState(initialPageId ?? initialPages[0]?.id ?? "");
  const [selectedBlockId, setSelectedBlockId] = useState("");
  const [autosaveState, setAutosaveState] = useState<AutosaveState>("idle");
  const [autosaveMessage, setAutosaveMessage] = useState("Autosaves after you stop editing.");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [toast, setToast] = useState<{ title: string; body: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DraftBlock | null>(null);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
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

  const notify = useCallback((title: string, body: string) => {
    setToast({ title, body });
  }, []);

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
      setAutosaveState("dirty");
      setAutosaveMessage("Recovered local draft. Save to persist it.");
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
    const snapshotKey = createBuilderSnapshotKey(pages, blocks);

    if (snapshotKey === lastSavedSnapshotRef.current) {
      window.sessionStorage.removeItem(storageKey);
      return;
    }

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
  const selectedBlock = selectedPageBlocks.find((block) => block.id === selectedBlockId) ?? null;
  const nextBlockSortOrder =
    selectedPageBlocks.reduce((highest, block) => Math.max(highest, block.sort_order), 0) + 1;
  const selectedPreviewBlocks = selectedPageBlocks.map(mapPreviewBlock);
  const pageCoverImage =
    toPreviewImageAsset(selectedPage?.cover_image, selectedPage?.title ?? lesson.title) ??
    (selectedPageIndex === 0 ? toPreviewImageAsset(lesson.cover_image, lesson.title) : null);
  const hasUnsavedChanges =
    createBuilderSnapshotKey(pages, blocks) !== lastSavedSnapshotRef.current ||
    autosaveState === "dirty" ||
    autosaveState === "error";

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!hasUnsavedChanges) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      if (!hasUnsavedChanges) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target || anchor.hasAttribute("download")) {
        return;
      }

      const href = anchor.href;
      if (!href || new URL(href).origin !== window.location.origin) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setPendingHref(`${anchor.pathname}${anchor.search}${anchor.hash}`);
    }

    document.addEventListener("click", handleDocumentClick, true);

    return () => {
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [hasUnsavedChanges]);

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
      window.sessionStorage.removeItem(storageKey);
      notify("Saved", payload.notice || "Lesson content saved.");
    } catch (error: unknown) {
      setAutosaveState("error");
      setAutosaveMessage(
        error instanceof Error ? error.message : "The lesson content could not be saved.",
      );
      notify("Save failed", error instanceof Error ? error.message : "The lesson content could not be saved.");
    } finally {
      saveInFlightRef.current = false;
      if (queuedSaveRef.current) {
        queuedSaveRef.current = false;
        void saveBuilderSnapshot();
      }
    }
  }, [autosaveState, lastSavedAt, lesson.id, notify, storageKey]);

  saveBuilderSnapshotRef.current = saveBuilderSnapshot;

  function createDraftBlock(blockType: string, pageId: string, sortOrder: number): DraftBlock {
    return {
      id: createDraftId(blockType),
      page_id: pageId,
      block_type: blockType,
      sort_order: sortOrder,
      payload:
        blockType === "callout"
          ? { variant: "key_point", label: "", title: "", body: "" }
          : blockType === "table"
            ? { title: "", columns: [], rows: [] }
            : blockType === "text"
              ? { heading: "", body: "<p></p>" }
              : {},
      isDraft: true,
    };
  }

  function addDraftBlock(blockType: string, insertIndex?: number) {
    if (!selectedPage) return;

    const block = createDraftBlock(blockType, selectedPage.id, nextBlockSortOrder);
    setBlocks((current) =>
      insertBlockAtPosition(
        current,
        selectedPage.id,
        block,
        typeof insertIndex === "number" ? insertIndex : selectedPageBlocks.length,
      ),
    );
    setSelectedBlockId(block.id);
    notify("Block added", "Save to persist the new content block.");
  }

  function addDraftPage() {
    const nextPageNumber =
      sortedPages.reduce((highest, page) => Math.max(highest, page.page_number), 0) + 1;
    const draftId = createDraftId("page");
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
    setSelectedBlockId("");
    notify("Page added", "Save to persist the new page.");
  }

  function updateBlock(blockId: string, key: string, value: unknown) {
    setBlocks((current) => updateBlockPayload(current, blockId, key, value));
  }

  function updatePage(page: AdminLessonPageRow) {
    setPages((current) => current.map((item) => (item.id === page.id ? page : item)));
  }

  function reorderPage(pageId: string, direction: ReorderDirection) {
    setPages((current) => swapPageOrder(current, pageId, direction));
  }

  function reorderPageById(activePageId: string, overPageId: string) {
    setPages((current) => reorderPagesById(current, activePageId, overPageId));
  }

  function reorderBlock(blockId: string, direction: ReorderDirection) {
    setBlocks((current) => swapBlockOrder(current, blockId, direction));
  }

  function reorderBlockById(activeBlockId: string, overBlockId: string) {
    setBlocks((current) => reorderBlocksById(current, activeBlockId, overBlockId));
  }

  function duplicatePage(pageId: string) {
    const sourcePage = sortedPages.find((page) => page.id === pageId);
    if (!sourcePage) return;

    const nextPageNumber = sortedPages.reduce((highest, page) => Math.max(highest, page.page_number), 0) + 1;
    const draftPageId = createDraftId("page");
    const timestamp = new Date().toISOString();
    const sourceBlocks = blocks
      .filter((block) => block.page_id === pageId)
      .sort((first, second) => first.sort_order - second.sort_order);

    setPages((current) => [
      ...current,
      {
        ...sourcePage,
        id: draftPageId,
        page_number: nextPageNumber,
        title: `Copy of ${sourcePage.title}`,
        created_at: timestamp,
        updated_at: timestamp,
      },
    ]);
    setBlocks((current) => [
      ...current,
      ...sourceBlocks.map((block, index) => ({
        ...block,
        id: createDraftId(block.block_type),
        page_id: draftPageId,
        sort_order: index + 1,
        isDraft: true,
      })),
    ]);
    setSelectedPageId(draftPageId);
    setSelectedBlockId("");
    notify("Page duplicated", "Save to persist the copied page and blocks.");
  }

  function duplicateBlock(block: DraftBlock) {
    const pageBlocks = blocks
      .filter((item) => item.page_id === block.page_id)
      .sort((first, second) => first.sort_order - second.sort_order);
    const sourceIndex = pageBlocks.findIndex((item) => item.id === block.id);
    const draftBlock = {
      ...block,
      id: createDraftId(block.block_type),
      isDraft: true,
    };

    setBlocks((current) =>
      insertBlockAtPosition(current, block.page_id, draftBlock, sourceIndex < 0 ? pageBlocks.length : sourceIndex + 1),
    );
    setSelectedBlockId(draftBlock.id);
    notify("Block duplicated", "Save to persist the copied block.");
  }

  function requestRemoveBlock(block: DraftBlock) {
    setDeleteTarget(block);
  }

  function removeBlock(block: DraftBlock) {
    if (block.isDraft) {
      setBlocks((current) => current.filter((item) => item.id !== block.id));
      setDeleteTarget(null);
      setSelectedBlockId((current) => (current === block.id ? "" : current));
      notify("Draft block removed", "The unsaved block was removed locally.");
      return;
    }

    setBlocks((current) => current.filter((item) => item.id !== block.id));
    setDeleteTarget(null);
    setSelectedBlockId((current) => (current === block.id ? "" : current));
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
          notify("Delete failed", "The block could not be removed. Refreshing to restore the latest version.");
          router.refresh();
        } else {
          notify("Block removed", "The content block was removed from the lesson.");
        }
      })
      .catch(() => {
        notify("Delete failed", "The block could not be removed. Refreshing to restore the latest version.");
        router.refresh();
      });
  }

  return (
    <Toast.Provider swipeDirection="right">
      <section className="mt-6 grid gap-4 xl:grid-cols-[18rem_minmax(0,1fr)_24rem]">
        <LessonBuilderPagesPanel
          blocks={blocks}
          onAddPage={addDraftPage}
          onDuplicatePage={duplicatePage}
          onReorderPage={reorderPage}
          onReorderPageById={reorderPageById}
          onSelectPage={(pageId) => {
            setSelectedPageId(pageId);
            setSelectedBlockId("");
          }}
          pages={sortedPages}
          selectedPageId={selectedPage?.id ?? ""}
        />

        <LessonBuilderEditorPanel
          autosaveDelayMs={AUTOSAVE_DELAY_MS}
          autosaveMessage={autosaveMessage}
          autosaveState={autosaveState}
          lastSavedAt={lastSavedAt}
          onAddDraftBlock={addDraftBlock}
          onDuplicateBlock={duplicateBlock}
          onRemoveBlock={requestRemoveBlock}
          onReorderBlock={reorderBlock}
          onReorderBlockById={reorderBlockById}
          onSaveNow={() => {
            void saveBuilderSnapshot(true);
          }}
          onSelectBlock={setSelectedBlockId}
          onUpdateBlock={updateBlock}
          mediaLibraryAssets={mediaLibraryAssets}
          selectedBlockId={selectedBlock?.id ?? ""}
          selectedPage={selectedPage}
          selectedPageBlocks={selectedPageBlocks}
        />

        <LessonBuilderInspectorPanel
          autosaveState={autosaveState}
          hasUnsavedChanges={hasUnsavedChanges}
          isSaving={autosaveState === "saving"}
          lastSavedAt={lastSavedAt}
          lesson={lesson}
          mediaLibraryAssets={mediaLibraryAssets}
          onDuplicateBlock={selectedBlock ? () => duplicateBlock(selectedBlock) : undefined}
          onDuplicatePage={selectedPage ? () => duplicatePage(selectedPage.id) : undefined}
          onRemoveBlock={selectedBlock ? () => requestRemoveBlock(selectedBlock) : undefined}
          onSaveNow={() => {
            void saveBuilderSnapshot(true);
          }}
          onUpdatePage={updatePage}
          pageCoverImage={pageCoverImage}
          selectedBlock={selectedBlock}
          selectedPage={selectedPage}
          selectedPreviewBlocks={selectedPreviewBlocks}
        />
      </section>

      <AlertDialog.Root open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/30" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-[18px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] p-5 shadow-xl">
            <AlertDialog.Title className="text-lg font-black">Remove block?</AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
              This removes the content block from the current lesson page. Saved blocks are deleted immediately.
            </AlertDialog.Description>
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <AlertDialog.Cancel className="inline-flex min-h-10 items-center justify-center rounded-[12px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] px-4 text-sm font-black text-[var(--ve-muted-strong)]" type="button">
                Cancel
              </AlertDialog.Cancel>
              <AlertDialog.Action
                className="inline-flex min-h-10 items-center justify-center rounded-[12px] bg-[color:color-mix(in_srgb,var(--ve-danger-soft)_80%,var(--ve-card))] px-4 text-sm font-black text-[var(--ve-danger)]"
                onClick={() => {
                  if (deleteTarget) removeBlock(deleteTarget);
                }}
                type="button"
              >
                Remove block
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>

      <AlertDialog.Root open={pendingHref !== null} onOpenChange={(open) => !open && setPendingHref(null)}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/30" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-[18px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] p-5 shadow-xl">
            <AlertDialog.Title className="text-lg font-black">Leave with unsaved changes?</AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
              Save the lesson builder before navigating away, or leave and keep the local recovery draft for this browser session.
            </AlertDialog.Description>
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <AlertDialog.Cancel className="inline-flex min-h-10 items-center justify-center rounded-[12px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] px-4 text-sm font-black text-[var(--ve-muted-strong)]" type="button">
                Stay
              </AlertDialog.Cancel>
              <button
                className="inline-flex min-h-10 items-center justify-center rounded-[12px] bg-[var(--ve-green)] px-4 text-sm font-black text-white"
                onClick={() => {
                  void saveBuilderSnapshot(true);
                  setPendingHref(null);
                }}
                type="button"
              >
                Save first
              </button>
              <AlertDialog.Action
                className="inline-flex min-h-10 items-center justify-center rounded-[12px] bg-[color:color-mix(in_srgb,var(--ve-danger-soft)_80%,var(--ve-card))] px-4 text-sm font-black text-[var(--ve-danger)]"
                onClick={() => {
                  if (pendingHref) router.push(pendingHref);
                }}
                type="button"
              >
                Leave
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>

      <Toast.Root
        className="rounded-[14px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] p-4 shadow-xl"
        duration={4200}
        onOpenChange={(open) => {
          if (!open) setToast(null);
        }}
        open={toast !== null}
      >
        <Toast.Title className="text-sm font-black">{toast?.title}</Toast.Title>
        <Toast.Description className="mt-1 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
          {toast?.body}
        </Toast.Description>
      </Toast.Root>
      <Toast.Viewport className="fixed bottom-5 right-5 z-[60] w-[calc(100vw-2rem)] max-w-sm" />
    </Toast.Provider>
  );
}
