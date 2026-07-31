"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  AdminLessonBlockRow,
  AdminLessonPageRow,
  AdminLessonRow,
} from "@/lib/admin";
import {
  createBuilderSnapshotKey,
  mapPreviewBlock,
  mergeDraftBlocks,
  mergeDraftPages,
  reconcileBuilderStateFromSave,
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
  LessonBuilderPagesPanel,
  LessonBuilderPreviewPanel,
  type AutosaveState,
} from "@/features/learning/admin/lesson-page-builder-ui";

type LessonPageBuilderProps = {
  lesson: AdminLessonRow;
  pages: AdminLessonPageRow[];
  blocks: AdminLessonBlockRow[];
  initialPageId?: string;
};

const AUTOSAVE_DELAY_MS = 15_000;

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

  function reorderPage(pageId: string, direction: ReorderDirection) {
    setPages((current) => swapPageOrder(current, pageId, direction));
  }

  function reorderBlock(blockId: string, direction: ReorderDirection) {
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
      <LessonBuilderPagesPanel
        blocks={blocks}
        lessonId={lesson.id}
        onAddPage={addDraftPage}
        onReorderPage={reorderPage}
        onSelectPage={setSelectedPageId}
        pages={sortedPages}
        selectedPageId={selectedPage?.id ?? ""}
      />

      <LessonBuilderEditorPanel
        autosaveDelayMs={AUTOSAVE_DELAY_MS}
        autosaveMessage={autosaveMessage}
        autosaveState={autosaveState}
        lastSavedAt={lastSavedAt}
        onAddDraftBlock={addDraftBlock}
        onRemoveBlock={removeBlock}
        onReorderBlock={reorderBlock}
        onSaveNow={() => {
          void saveBuilderSnapshot(true);
        }}
        onUpdateBlock={updateBlock}
        onUpdatePage={updatePage}
        selectedPage={selectedPage}
        selectedPageBlocks={selectedPageBlocks}
      />

      <LessonBuilderPreviewPanel
        lesson={lesson}
        pageCoverImage={pageCoverImage}
        selectedPage={selectedPage}
        selectedPreviewBlocks={selectedPreviewBlocks}
      />
    </section>
  );
}
