"use client";
import { ImageDraftContext } from "@/components/admin/MediaPickerProvider";

import * as AlertDialog from "@radix-ui/react-alert-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Toast from "@radix-ui/react-toast";
import Link from "next/link";
import { publishedLessonContent } from "@/features/learning/application/published-lesson-content";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminNoticeBanner } from "@/components/admin/AdminPrimitives";
import { LessonAuthoringSteps } from "@/components/admin/LessonAuthoringSteps";
import { AiPageAuthoring } from "@/components/admin/ai/AiPageAuthoring";
import type { AuthoringResult, ApplicationReceipt } from "@/features/ai-generation/authoring/contracts";
import type {
  AdminLearningMediaAssetRow,
  AdminLessonBlockRow,
  AdminLessonPageRow,
  AdminLessonRow,
} from "@/lib/admin";
import {
  createBuilderSnapshotKey,
  lessonMetadataKey,
  createDraftId,
  insertBlockAtPosition,
  mergeDraftBlocks,
  mergeDraftPages,
  reconcileBuilderStateFromSave,
  reorderBlocksById,
  reorderPagesById,
  swapBlockOrder,
  updateBlockPayload,
  type BuilderDraftSnapshot,
  type BuilderSaveResponse,
  type DraftBlock,
  type ReorderDirection,
} from "@/features/learning/admin/lesson-page-builder-domain";
import {
  LessonBuilderEditorPanel,
  LessonBuilderPagesPanel,
  type AutosaveState,
} from "@/features/learning/admin/lesson-page-builder-ui";

type LessonPageBuilderProps = {
  aiPagePilotEnabled?: boolean;
  initialAiResultId?: string;
  aiGenerationAvailable?: boolean;
  allowedBlockTypes?: string[];
  blocks: AdminLessonBlockRow[];
  initialPageId?: string;
  lesson: AdminLessonRow;
  mediaLibraryAssets?: AdminLearningMediaAssetRow[];
  notice?: string;
  pages: AdminLessonPageRow[];
  questionCount?: number;
};

const AUTOSAVE_DELAY_MS = 15_000;

export function LessonPageBuilder({
  aiPagePilotEnabled = false,
  initialAiResultId,
  aiGenerationAvailable = true,
  allowedBlockTypes,
  lesson,
  pages: initialPages,
  blocks: initialBlocks,
  initialPageId,
  mediaLibraryAssets = [],
  notice,
  questionCount = 0,
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
  const [deletePageTarget, setDeletePageTarget] = useState<AdminLessonPageRow | null>(null);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [lessonStatus, setLessonStatus] = useState(lesson.status);
  const [publishedAt, setPublishedAt] = useState(lesson.published_at ?? null);
  const [publishState, setPublishState] = useState<"idle" | "publishing" | "reverting">("idle");
  const [revertConfirmOpen, setRevertConfirmOpen] = useState(false);
  const storageKey = `lesson-builder-draft:${lesson.id}`;
  const hasHydratedDraftRef = useRef(false);
  const pagesRef = useRef(pages);
  const blocksRef = useRef(blocks);
  const selectedPageIdRef = useRef(selectedPageId);
  const saveTimerRef = useRef<number | null>(null);
  const saveInFlightRef = useRef(false);
  const saveWaitersRef = useRef<Array<() => void>>([]);
  const queuedSaveRef = useRef(false);
  const lastSavedSnapshotRef = useRef(createBuilderSnapshotKey(initialPages, initialBlocks));
  const saveBuilderSnapshotRef = useRef<(force?: boolean) => Promise<boolean>>(async () => false);
  const imageTargetIdsRef = useRef(new Map<string, string>());
  const draftRevisionRef = useRef(lesson.draft_revision ?? 0);
  const [publishedSnapshot, setPublishedSnapshot] = useState(lesson.published_snapshot ?? null);
  const publishedContent = useMemo(() => {
    if (!publishedSnapshot) return null;
    const content = publishedLessonContent(lesson.id, publishedSnapshot);
    return { pages: content.pages.map((page) => ({ ...page, created_at: "", updated_at: "" })), blocks: content.blocks };
  }, [lesson.id, publishedSnapshot]);

  const notify = useCallback((title: string, body: string) => {
    setToast({ title, body });
  }, []);

  useEffect(() => {
    const raw = window.sessionStorage.getItem(storageKey);
    const currentServerSnapshotKey = createBuilderSnapshotKey(initialPages, initialBlocks);

    if (!raw) {
      hasHydratedDraftRef.current = true;
      return;
    }

    try {
      const snapshot = JSON.parse(raw) as Partial<BuilderDraftSnapshot>;

      // Only trust a locally-recovered draft if it was captured on top of the
      // exact server content we just loaded. If the server content has since
      // changed (published elsewhere, saved from another tab, etc.), this
      // draft is stale and applying it would silently show — and risk
      // re-saving — content that diverges from what's actually live.
      if (snapshot.baseSnapshotKey !== currentServerSnapshotKey) {
        window.sessionStorage.removeItem(storageKey);
        setPages(initialPages);
        setBlocks(initialBlocks);
        setSelectedPageId(initialPageId ?? initialPages[0]?.id ?? "");
        lastSavedSnapshotRef.current = currentServerSnapshotKey;
        hasHydratedDraftRef.current = true;
        return;
      }

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
      lastSavedSnapshotRef.current = currentServerSnapshotKey;
      setAutosaveState("dirty");
      setAutosaveMessage("Recovered local draft. Save to persist it.");
    } catch {
      window.sessionStorage.removeItem(storageKey);
      setPages(initialPages);
      setBlocks(initialBlocks);
      setSelectedPageId(initialPageId ?? initialPages[0]?.id ?? "");
      lastSavedSnapshotRef.current = currentServerSnapshotKey;
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
      baseSnapshotKey: createBuilderSnapshotKey(initialPages, initialBlocks),
    };
    const snapshotKey = createBuilderSnapshotKey(pages, blocks);

    if (snapshotKey === lastSavedSnapshotRef.current) {
      window.sessionStorage.removeItem(storageKey);
      return;
    }

    window.sessionStorage.setItem(storageKey, JSON.stringify(snapshot));
  }, [blocks, initialBlocks, initialPages, pages, selectedPageId, storageKey]);

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
  const hasUnsavedChanges =
    createBuilderSnapshotKey(pages, blocks) !== lastSavedSnapshotRef.current ||
    autosaveState === "dirty" ||
    autosaveState === "error";
  const hasUnpublishedChanges = publishedContent !== null && (
    createBuilderSnapshotKey(pages, blocks) !== createBuilderSnapshotKey(publishedContent.pages, publishedContent.blocks) ||
    lessonMetadataKey(lesson) !== lessonMetadataKey((publishedSnapshot?.lesson ?? {}) as Record<string, unknown>)
  );

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
      return false;
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
      return true;
    }

    if (saveInFlightRef.current) {
      queuedSaveRef.current = true;
      return false;
    }

    saveInFlightRef.current = true;
    setAutosaveState("saving");
    setAutosaveMessage("Saving changes...");

    const submittedPages = pagesRef.current;
    const submittedBlocks = blocksRef.current;
    try {
      const response = await fetch("/api/admin/learning/builder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lessonId: lesson.id,
          pages: submittedPages,
          blocks: submittedBlocks,
          expectedRevision: draftRevisionRef.current,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as BuilderSaveResponse & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "The lesson content could not be saved.");
      }

      if (!Number.isSafeInteger(payload.draftRevision)) throw new Error("The saved revision was not returned.");
      for (const block of payload.blocks ?? []) imageTargetIdsRef.current.set(block.clientId, block.blockId);
      for (const page of payload.pages ?? []) imageTargetIdsRef.current.set(page.clientId, page.pageId);
      draftRevisionRef.current = payload.draftRevision!;
      const saved = reconcileBuilderStateFromSave(submittedPages, submittedBlocks, selectedPageIdRef.current, payload);
      const reconciled = reconcileBuilderStateFromSave(
        pagesRef.current,
        blocksRef.current,
        selectedPageIdRef.current,
        payload,
        submittedPages,
        submittedBlocks,
      );

      pagesRef.current = reconciled.pages;
      blocksRef.current = reconciled.blocks;
      selectedPageIdRef.current = reconciled.selectedPageId;
      setPages(reconciled.pages);
      setBlocks(reconciled.blocks);
      setSelectedPageId(reconciled.selectedPageId);

      lastSavedSnapshotRef.current = createBuilderSnapshotKey(saved.pages, saved.blocks);
      setAutosaveState("saved");
      setAutosaveMessage(payload.notice || "All changes saved.");
      setLastSavedAt(payload.savedAt ?? new Date().toISOString());
      window.sessionStorage.removeItem(storageKey);
      notify("Saved", payload.notice || "Lesson content saved.");
      return true;
    } catch (error: unknown) {
      setAutosaveState("error");
      setAutosaveMessage(
        error instanceof Error ? error.message : "The lesson content could not be saved.",
      );
      notify("Save failed", error instanceof Error ? error.message : "The lesson content could not be saved.");
      return false;
    } finally {
      saveInFlightRef.current = false;
      saveWaitersRef.current.splice(0).forEach(resolve => resolve());
      if (queuedSaveRef.current) {
        queuedSaveRef.current = false;
        void saveBuilderSnapshot();
      }
    }
  }, [autosaveState, lastSavedAt, lesson.id, notify, storageKey]);

  saveBuilderSnapshotRef.current = saveBuilderSnapshot;

  const prepareAiAction = useCallback(async () => {
    // An autosave already in progress belongs to this same editor. Let it
    // finish before checking the latest snapshot instead of asking for a retry.
    while (saveInFlightRef.current) {
      await new Promise<void>(resolve => saveWaitersRef.current.push(resolve));
    }
    if (!await saveBuilderSnapshotRef.current() || saveInFlightRef.current
      || createBuilderSnapshotKey(pagesRef.current, blocksRef.current) !== lastSavedSnapshotRef.current) {
      throw new Error("Your latest changes have not saved yet. Finish saving the lesson, then try again.");
    }
    return draftRevisionRef.current;
  }, []);

  const reconcileAiPage = useCallback((result: AuthoringResult, receipt: ApplicationReceipt) => {
    if (!receipt.page || !receipt.blocks || pagesRef.current.some(p => p.id === receipt.pageId)) return;
    if (saveInFlightRef.current || createBuilderSnapshotKey(pagesRef.current, blocksRef.current) !== lastSavedSnapshotRef.current) {
      notify("Page saved", "Your generated page was saved. Your newer edits are still here; open the saved page after resolving them.");
      return;
    }
    const nextPages = [...pagesRef.current.map(p => p.page_number >= result.position ? { ...p, page_number: p.page_number + 1 } : p), receipt.page];
    const nextBlocks = [...blocksRef.current, ...receipt.blocks];
    pagesRef.current = nextPages; blocksRef.current = nextBlocks;
    setPages(nextPages); setBlocks(nextBlocks);
    draftRevisionRef.current = receipt.draftRevision;
    lastSavedSnapshotRef.current = createBuilderSnapshotKey(nextPages, nextBlocks);
    setSelectedPageId(receipt.pageId); setAutosaveState("saved");
    setAutosaveMessage("Generated page added and saved.");
    window.sessionStorage.removeItem(storageKey);
  }, [notify, storageKey]);

  const reconcileAiImage = useCallback((receipt: ApplicationReceipt) => {
    if (!receipt.page || !receipt.blocks) return;
    if (saveInFlightRef.current || createBuilderSnapshotKey(pagesRef.current, blocksRef.current) !== lastSavedSnapshotRef.current) {
      notify("Image saved", "Your newer edits are still here. Reload after resolving them to see the saved image.");
      return;
    }
    const nextPages = pagesRef.current.map(p => p.id === receipt.pageId ? receipt.page! : p);
    const nextBlocks = [...blocksRef.current.filter(b => b.page_id !== receipt.pageId), ...receipt.blocks];
    pagesRef.current = nextPages; blocksRef.current = nextBlocks; setPages(nextPages); setBlocks(nextBlocks);
    draftRevisionRef.current = receipt.draftRevision;
    lastSavedSnapshotRef.current = createBuilderSnapshotKey(nextPages, nextBlocks);
    setAutosaveState("saved"); setAutosaveMessage("Image added and saved.");
    window.sessionStorage.removeItem(storageKey);
  }, [notify, storageKey]);

  async function saveAndNavigate(href: string) {
    const saved = await saveBuilderSnapshotRef.current();
    if (!saved) return;
    if (saveInFlightRef.current || createBuilderSnapshotKey(pagesRef.current, blocksRef.current) !== lastSavedSnapshotRef.current) {
      notify("Changes still pending", "Finish editing, then continue once your latest changes have saved.");
      return;
    }
    setPendingHref(null);
    router.push(href);
  }

  function createDraftBlock(blockType: string, pageId: string, sortOrder: number): DraftBlock {
    // A GIF is stored as an image block flagged in its payload — there is no
    // dedicated DB enum value, so it renders and is picked exactly like an image.
    const isGif = blockType === "gif";
    const storedBlockType = isGif ? "image" : blockType;

    return {
      id: createDraftId(blockType),
      page_id: pageId,
      block_type: storedBlockType,
      sort_order: sortOrder,
      payload:
        storedBlockType === "callout"
          ? { variant: "key_point", label: "", title: "", body: "" }
          : storedBlockType === "table"
            ? { title: "", columns: [], rows: [] }
            : storedBlockType === "text"
              ? { heading: "", body: "<p></p>" }
              : isGif
                ? { mediaKind: "gif" }
                : {},
      isDraft: true,
    };
  }

  function addDraftBlock(blockType: string, insertIndex?: number) {
    if (!selectedPage) return;
    const entitlementBlockType = blockType === "gif" ? "image" : blockType;
    if (allowedBlockTypes && !allowedBlockTypes.includes(entitlementBlockType)) {
      notify("Block unavailable", "This organisation plan does not include that content block type.");
      return;
    }

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
    setBlocks((current) => updateBlockPayload(current, imageTargetIdsRef.current.get(blockId) ?? blockId, key, value));
  }

  function updatePage(page: AdminLessonPageRow) {
    setPages((current) => current.map((item) => (item.id === page.id ? page : item)));
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
    setBlocks((current) => current.filter((item) => item.id !== block.id));
    setDeleteTarget(null);
    setSelectedBlockId((current) => current === block.id ? "" : current);
    notify("Block removed", "The deletion will be included in the next save.");
  }

  function requestDeletePage(page: AdminLessonPageRow) {
    setDeletePageTarget(page);
  }

  function removePage(page: AdminLessonPageRow) {
    if (pages.length <= 1) return;
    setPages((current) => current.filter((item) => item.id !== page.id)
      .sort((a, b) => a.page_number - b.page_number).map((item, index) => ({ ...item, page_number: index + 1 })));
    setBlocks((current) => current.filter((item) => item.page_id !== page.id));
    setDeletePageTarget(null);
    setSelectedPageId((current) => current === page.id ? "" : current);
    setSelectedBlockId("");
    notify("Page removed", "The deletion will be included in the next save. Published progress is preserved.");
  }

  async function publishLesson() {
    if (publishState !== "idle" || autosaveState === "saving") return;

    setPublishState("publishing");
    try {
      const saved = await saveBuilderSnapshotRef.current(true);

      if (!saved || saveInFlightRef.current || createBuilderSnapshotKey(pagesRef.current, blocksRef.current) !== lastSavedSnapshotRef.current) {
        throw new Error("Unsaved changes could not be saved. Fix the error above, then try publishing again.");
      }

      const response = await fetch("/api/admin/learning/publish-lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId: lesson.id, courseId: lesson.course_id, expectedRevision: draftRevisionRef.current }),
      });
      const payload = (await response.json().catch(() => ({}))) as { publishedAt?: string; error?: string; draftRevision: number; publishedSnapshot: Record<string, unknown> };

      if (!response.ok) {
        throw new Error(payload.error || "The lesson could not be published.");
      }

      setPublishedSnapshot(payload.publishedSnapshot);
      draftRevisionRef.current = payload.draftRevision;
      setLessonStatus("published");
      setPublishedAt(payload.publishedAt ?? new Date().toISOString());
      notify("Lesson published", "Learners will now see this version.");
    } catch (error) {
      notify("Publish failed", error instanceof Error ? error.message : "The lesson could not be published.");
    } finally {
      setPublishState("idle");
    }
  }

  function requestRevert() {
    setRevertConfirmOpen(true);
  }

  async function confirmRevert() {
    setRevertConfirmOpen(false);
    if (publishState !== "idle" || autosaveState === "saving" || saveInFlightRef.current) {
      notify("Still saving", "Wait for the current save to finish, then try reverting again.");
      return;
    }

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    window.sessionStorage.removeItem(storageKey);
    setPublishState("reverting");

    try {
      const response = await fetch("/api/admin/learning/revert-lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId: lesson.id, courseId: lesson.course_id, expectedRevision: draftRevisionRef.current }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; draftRevision: number };

      if (!response.ok) {
        throw new Error(payload.error || "The lesson could not be reverted.");
      }

      draftRevisionRef.current = payload.draftRevision;
      const published = publishedContent;
      if (published) {
        pagesRef.current = published.pages;
        blocksRef.current = published.blocks;
        setPages(published.pages);
        setBlocks(published.blocks);
        setSelectedPageId(published.pages[0]?.id ?? "");
        setSelectedBlockId("");
        lastSavedSnapshotRef.current = createBuilderSnapshotKey(published.pages, published.blocks);
      }

      setAutosaveState("saved");
      setAutosaveMessage("Reverted to the published version.");
      setLastSavedAt(new Date().toISOString());
      notify("Reverted", "The draft now matches the published version.");
      router.refresh();
    } catch (error) {
      notify("Revert failed", error instanceof Error ? error.message : "The lesson could not be reverted.");
    } finally {
      setPublishState("idle");
    }
  }

  return (
    <ImageDraftContext.Provider value={{ beforeAction: prepareAiAction, onApplied: reconcileAiImage, resolveTarget: target => ({ ...target, targetId: imageTargetIdsRef.current.get(target.targetId) ?? target.targetId }) }}><Toast.Provider swipeDirection="right">
      <fieldset className="min-w-0" disabled={publishState !== "idle"} inert={publishState !== "idle"}>
      <div className="-mx-5 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--admin-border-warm)] px-5 py-5 md:-mx-8 md:px-10">
        <Link
          className="inline-flex items-center gap-2 text-sm font-bold text-[var(--admin-on-surface-variant)]"
          href={`/admin/courses/${lesson.course_id}`}
        >
          <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" viewBox="0 0 24 24">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Curriculum
        </Link>
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="truncate text-sm font-extrabold text-[var(--admin-on-surface)]">{lesson.title}</span>
          <span
            className={`shrink-0 rounded-full px-2.5 py-[3px] text-[10px] font-extrabold uppercase tracking-[0.06em] ${
              lessonStatus === "published"
                ? "bg-[#e6f4ea] text-[#0b5a3a]"
                : lessonStatus === "archived"
                  ? "bg-[var(--admin-surface-container-low)] text-[var(--admin-outline)]"
                  : "bg-[var(--admin-surface-container)] text-[var(--admin-on-surface-variant)]"
            }`}
            title={
              lessonStatus === "published" && publishedAt
                ? `Published ${new Date(publishedAt).toLocaleDateString()}${hasUnpublishedChanges ? " · has unpublished changes" : ""}`
                : undefined
            }
          >
            {lessonStatus === "published" ? "Published" : lessonStatus === "archived" ? "Archived" : "Draft"}
            {lessonStatus === "published" && hasUnpublishedChanges ? " •" : ""}
          </span>
        </span>
        <div className="flex flex-wrap items-center gap-2.5">
          {lessonStatus === "published" ? (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger
                aria-label="More lesson actions"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] text-[var(--admin-on-surface-variant)]"
                type="button"
              >
                ⋯
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  className="z-50 min-w-56 rounded-[14px] border border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] p-2 shadow-xl"
                  sideOffset={6}
                >
                  <DropdownMenu.Item asChild>
                    <button
                      className="w-full rounded-[10px] px-3 py-2 text-left text-sm font-bold text-[var(--admin-error)] outline-none hover:bg-[var(--admin-surface-container-low)] disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={publishState !== "idle" || autosaveState === "saving" || !hasUnpublishedChanges}
                      onClick={requestRevert}
                      type="button"
                    >
                      Revert to published
                    </button>
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          ) : null}
          <button
            className="rounded-full border border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] px-5 py-[11px] text-[13px] font-extrabold text-[var(--admin-on-surface)] disabled:opacity-60"
            disabled={publishState !== "idle" || autosaveState === "saving" || (lessonStatus === "published" && !hasUnpublishedChanges)}
            onClick={() => {
              if (lesson.ai_generated && lesson.ai_publish_status !== "ready" && lesson.ai_publish_status !== "published") {
                void saveAndNavigate(`/admin/courses/lessons/${lesson.id}/preview?section=review`);
              } else {
                void publishLesson();
              }
            }}
            type="button"
          >
            {publishState === "publishing"
              ? "Publishing..."
              : lessonStatus === "published"
                ? "Publish changes"
                : "Publish"}
          </button>
          <button
            className="rounded-full bg-[var(--admin-primary)] px-[22px] py-[11px] text-[13px] font-extrabold text-[var(--admin-on-primary)] disabled:opacity-60"
            disabled={autosaveState === "saving"}
            onClick={() => {
              void saveBuilderSnapshot(true);
            }}
            type="button"
          >
            {autosaveState === "saving" ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      <LessonAuthoringSteps current="pages" lessonId={lesson.id} pageCount={pages.length} questionCount={questionCount} />
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--admin-border-warm)] py-4">
        <p className="text-sm font-semibold text-[var(--admin-on-surface-variant)]">Write your pages, add a quiz, choose the values learners will explore, then preview and review.</p>
        <button className="rounded-full bg-[var(--admin-primary)] px-5 py-3 text-sm font-extrabold text-[var(--admin-on-primary)] disabled:opacity-60" disabled={pages.length === 0 || autosaveState === "saving"} onClick={() => { void saveAndNavigate(`/admin/courses/lessons/${lesson.id}/quiz`); }} type="button">Next: Quiz</button>
      </div>

      {notice ? (
        <div className="px-5 pt-5 md:px-10">
          <AdminNoticeBanner>{notice}</AdminNoticeBanner>
        </div>
      ) : null}

      <section className="grid xl:grid-cols-[240px_minmax(0,1fr)]">
        <LessonBuilderPagesPanel
          aiAuthoringControls={<AiPageAuthoring enabled={aiPagePilotEnabled && aiGenerationAvailable}
            lessonId={lesson.id} pageCount={pages.length} initialResultId={initialAiResultId}
            beforeAction={prepareAiAction} onApplied={reconcileAiPage} />}
          onAddPage={addDraftPage}
          onDuplicatePage={duplicatePage}
          onRequestDeletePage={requestDeletePage}
          onReorderPageById={reorderPageById}
          onSelectPage={(pageId) => {
            setSelectedPageId(pageId);
            setSelectedBlockId("");
          }}
          pages={sortedPages}
          selectedPageId={selectedPage?.id ?? ""}
        />

        <LessonBuilderEditorPanel
          lesson={lesson}
          aiGenerationAvailable={aiGenerationAvailable}
          allowedBlockTypes={allowedBlockTypes}
          autosaveDelayMs={AUTOSAVE_DELAY_MS}
          autosaveMessage={autosaveMessage}
          autosaveState={autosaveState}
          lastSavedAt={lastSavedAt}
          onAddDraftBlock={addDraftBlock}
          onDuplicateBlock={duplicateBlock}
          onRemoveBlock={requestRemoveBlock}
          onReorderBlock={reorderBlock}
          onReorderBlockById={reorderBlockById}
          onSelectBlock={setSelectedBlockId}
          onUpdateBlock={updateBlock}
          onUpdatePage={updatePage}
          mediaLibraryAssets={mediaLibraryAssets}
          selectedBlockId={selectedBlock?.id ?? ""}
          selectedPage={selectedPage}
          selectedPageBlocks={selectedPageBlocks}
        />
      </section>

      <AlertDialog.Root open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/30" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-[18px] border border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] p-5 shadow-xl">
            <AlertDialog.Title className="text-lg font-black">Remove block?</AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-sm font-semibold leading-6 text-[var(--admin-on-surface-variant)]">
              This removes the content block from the current lesson page. The deletion is saved with the rest of your draft.
            </AlertDialog.Description>
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <AlertDialog.Cancel className="inline-flex min-h-10 items-center justify-center rounded-[12px] border border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] px-4 text-sm font-black text-[var(--admin-on-surface-variant)]" type="button">
                Cancel
              </AlertDialog.Cancel>
              <AlertDialog.Action
                className="inline-flex min-h-10 items-center justify-center rounded-[12px] bg-[color:color-mix(in_srgb,var(--admin-error-container)_80%,var(--admin-surface-milk))] px-4 text-sm font-black text-[var(--admin-error)]"
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

      <AlertDialog.Root open={deletePageTarget !== null} onOpenChange={(open) => !open && setDeletePageTarget(null)}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/30" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-[18px] border border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] p-5 shadow-xl">
            <AlertDialog.Title className="text-lg font-black">Delete page?</AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-sm font-semibold leading-6 text-[var(--admin-on-surface-variant)]">
              This removes the page and all of its content blocks from the lesson. The deletion is saved with the rest of your draft; published progress is preserved.
            </AlertDialog.Description>
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <AlertDialog.Cancel className="inline-flex min-h-10 items-center justify-center rounded-[12px] border border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] px-4 text-sm font-black text-[var(--admin-on-surface-variant)]" type="button">
                Cancel
              </AlertDialog.Cancel>
              <AlertDialog.Action
                className="inline-flex min-h-10 items-center justify-center rounded-[12px] bg-[color:color-mix(in_srgb,var(--admin-error-container)_80%,var(--admin-surface-milk))] px-4 text-sm font-black text-[var(--admin-error)]"
                onClick={() => {
                  if (deletePageTarget) removePage(deletePageTarget);
                }}
                type="button"
              >
                Delete page
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>

      <AlertDialog.Root open={revertConfirmOpen} onOpenChange={setRevertConfirmOpen}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/30" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-[18px] border border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] p-5 shadow-xl">
            <AlertDialog.Title className="text-lg font-black">Revert to published?</AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-sm font-semibold leading-6 text-[var(--admin-on-surface-variant)]">
              This discards every draft change — lesson settings, cover, pages, blocks, and reordering — since this lesson was last published,
              and restores exactly what learners currently see. This cannot be undone.
            </AlertDialog.Description>
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <AlertDialog.Cancel className="inline-flex min-h-10 items-center justify-center rounded-[12px] border border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] px-4 text-sm font-black text-[var(--admin-on-surface-variant)]" type="button">
                Cancel
              </AlertDialog.Cancel>
              <AlertDialog.Action
                className="inline-flex min-h-10 items-center justify-center rounded-[12px] bg-[color:color-mix(in_srgb,var(--admin-error-container)_80%,var(--admin-surface-milk))] px-4 text-sm font-black text-[var(--admin-error)]"
                onClick={() => {
                  void confirmRevert();
                }}
                type="button"
              >
                Revert to published
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>

      <AlertDialog.Root open={pendingHref !== null} onOpenChange={(open) => !open && setPendingHref(null)}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/30" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-[18px] border border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] p-5 shadow-xl">
            <AlertDialog.Title className="text-lg font-black">Leave with unsaved changes?</AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-sm font-semibold leading-6 text-[var(--admin-on-surface-variant)]">
              Save the lesson builder before navigating away, or leave and keep the local recovery draft for this browser session.
            </AlertDialog.Description>
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <AlertDialog.Cancel className="inline-flex min-h-10 items-center justify-center rounded-[12px] border border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] px-4 text-sm font-black text-[var(--admin-on-surface-variant)]" type="button">
                Stay
              </AlertDialog.Cancel>
              <button
                className="inline-flex min-h-10 items-center justify-center rounded-[12px] bg-[var(--admin-primary)] px-4 text-sm font-black text-white"
                onClick={() => {
                  if (pendingHref) void saveAndNavigate(pendingHref);
                }}
                disabled={autosaveState === "saving"}
                type="button"
              >
                Save first
              </button>
              <AlertDialog.Action
                className="inline-flex min-h-10 items-center justify-center rounded-[12px] bg-[color:color-mix(in_srgb,var(--admin-error-container)_80%,var(--admin-surface-milk))] px-4 text-sm font-black text-[var(--admin-error)]"
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

      </fieldset>
      <Toast.Root
        className="rounded-[14px] border border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] p-4 shadow-xl"
        duration={4200}
        onOpenChange={(open) => {
          if (!open) setToast(null);
        }}
        open={toast !== null}
      >
        <Toast.Title className="text-sm font-black">{toast?.title}</Toast.Title>
        <Toast.Description className="mt-1 text-xs font-semibold leading-5 text-[var(--admin-on-surface-variant)]">
          {toast?.body}
        </Toast.Description>
      </Toast.Root>
      <Toast.Viewport className="fixed bottom-5 right-5 z-[60] w-[calc(100vw-2rem)] max-w-sm" />
    </Toast.Provider></ImageDraftContext.Provider>
  );
}
