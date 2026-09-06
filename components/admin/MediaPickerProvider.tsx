"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { AdminDrawer } from "@/components/admin/AdminDialog";
import { MediaPickerScreen } from "@/components/admin/MediaPickerScreen";
import type { AdminLearningMediaAssetRow } from "@/lib/admin";
import type { ImageFit } from "@/lib/image-presentation";

export const ImageDraftContext = createContext<import("@/features/ai-generation/authoring/image-contracts").ImageDraft | undefined>(undefined);

export type MediaPickerRequestConfig = {
  initialTab?: "library" | "upload" | "ai";
  imageTarget?: import("@/features/ai-generation/authoring/image-contracts").ImageTarget;
  imageDraft?: import("@/features/ai-generation/authoring/image-contracts").ImageDraft;
  onGenerationStyleChange?: (style: import("@/features/ai-generation/authoring/image-style").ImageStyle | "inherit") => void;
  aiGenerationAvailable?: boolean;
  assetTypeFilter?: string[];
  caption?: string;
  initialAltText?: string;
  initialGenerationBrief?: string;
  onGenerationBriefChange?: (brief: string) => void;
  initialFit?: ImageFit | string;
  initialPositionX?: number;
  initialPositionY?: number;
  initialUrl?: string;
  isGif?: boolean;
  libraryAssets?: AdminLearningMediaAssetRow[];
  mediaKind?: "image" | "video" | "audio";
  placementLabel: string;
  title: string;
  uploadContext?: {
    assetType: string;
    courseId?: string | null;
    lessonId?: string | null;
    placement: string;
  };
};

export type PickedMedia = {
  alreadyApplied?: boolean;
  assetVersionId?: string;
  altText: string;
  caption: string;
  fit: ImageFit;
  positionX: number;
  positionY: number;
  url: string;
};

type PendingRequest = MediaPickerRequestConfig & {
  settled: boolean;
  resolve: (value: PickedMedia | null) => void;
};

type MediaPickerContextValue = {
  requestMedia: (config: MediaPickerRequestConfig) => Promise<PickedMedia | null>;
};

const MediaPickerContext = createContext<MediaPickerContextValue | null>(null);

export function MediaPickerProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingRequest | null>(null);
  const pendingRef = useRef<PendingRequest | null>(null);

  const requestMedia = useCallback((config: MediaPickerRequestConfig) => {
    return new Promise<PickedMedia | null>((resolve) => {
      const request: PendingRequest = { ...config, resolve, settled: false };
      pendingRef.current = request;
      setPending(request);
    });
  }, []);

  // Always settles the promise exactly once, whichever way the drawer closes:
  // a picked asset, the close button, Escape, or a click on the overlay.
  const settle = useCallback((value: PickedMedia | null) => {
    const current = pendingRef.current;
    pendingRef.current = null;
    setPending(null);
    if (!current || current.settled) return;
    current.settled = true;
    current.resolve(value);
  }, []);

  const value = useMemo(() => ({ requestMedia }), [requestMedia]);

  return (
    <MediaPickerContext.Provider value={value}>
      {children}
      <AdminDrawer
        onOpenChange={(open) => {
          if (!open) settle(null);
        }}
        open={pending !== null}
        title={pending?.title ?? "Choose media"}
        widthClassName="w-full max-w-[560px]"
      >
        {pending ? <MediaPickerScreen onPick={settle} request={pending} /> : null}
      </AdminDrawer>
    </MediaPickerContext.Provider>
  );
}

export function useMediaPicker() {
  const context = useContext(MediaPickerContext);
  const imageDraft = useContext(ImageDraftContext);
  if (!context) {
    throw new Error("useMediaPicker must be used within a MediaPickerProvider.");
  }
  return { requestMedia: (config: MediaPickerRequestConfig) => context.requestMedia({ ...config, imageDraft: config.imageDraft ?? imageDraft }) };
}
