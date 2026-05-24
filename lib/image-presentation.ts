import type { CSSProperties } from "react";

export type ImageFit = "cover" | "contain";

type PresentableImage = {
  fit?: string | null;
  positionX?: number | null;
  positionY?: number | null;
};

export function normalizeImageFit(value: unknown): ImageFit {
  return value === "contain" ? "contain" : "cover";
}

export function normalizeImagePosition(value: unknown, fallback = 50) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(100, Math.max(0, Math.round(value)));
}

export function getImageFitClass(image: PresentableImage | null | undefined) {
  return normalizeImageFit(image?.fit) === "contain" ? "object-contain" : "object-cover";
}

export function getImagePresentationStyle(
  image: PresentableImage | null | undefined,
): CSSProperties {
  const x = normalizeImagePosition(image?.positionX, 50);
  const y = normalizeImagePosition(image?.positionY, 50);

  return {
    objectPosition: `${x}% ${y}%`,
  };
}

export function parseImagePresentation(
  image: Record<string, unknown> | null | undefined,
) {
  return {
    fit: normalizeImageFit(image?.fit),
    positionX: normalizeImagePosition(image?.positionX, 50),
    positionY: normalizeImagePosition(image?.positionY, 50),
  };
}
