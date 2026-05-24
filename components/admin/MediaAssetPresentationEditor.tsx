"use client";

import { useState } from "react";
import {
  getImageFitClass,
  getImagePresentationStyle,
  normalizeImageFit,
  normalizeImagePosition,
  type ImageFit,
} from "@/lib/image-presentation";

type MediaAssetPresentationEditorProps = {
  initialAltText: string;
  initialFit: ImageFit;
  initialPositionX: number;
  initialPositionY: number;
  initialUrl: string;
  placementLabel: string;
  previewVariant?: "generic" | "course-thumbnail" | "course-cover";
  previewTitle?: string;
  previewEyebrow?: string;
  previewDescription?: string;
  previewMinutes?: number;
};

export function MediaAssetPresentationEditor({
  initialAltText,
  initialFit,
  initialPositionX,
  initialPositionY,
  initialUrl,
  placementLabel,
  previewVariant = "generic",
  previewTitle,
  previewEyebrow,
  previewDescription,
  previewMinutes,
}: MediaAssetPresentationEditorProps) {
  const [url, setUrl] = useState(initialUrl);
  const [altText, setAltText] = useState(initialAltText);
  const [fit, setFit] = useState<ImageFit>(normalizeImageFit(initialFit));
  const [positionX, setPositionX] = useState(normalizeImagePosition(initialPositionX, 50));
  const [positionY, setPositionY] = useState(normalizeImagePosition(initialPositionY, 50));
  const hasPreview = url.trim().length > 0;
  const previewImage = hasPreview ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={altText.trim() || placementLabel}
      className={`h-full w-full ${getImageFitClass({ fit })}`}
      src={url}
      style={getImagePresentationStyle({ fit, positionX, positionY })}
    />
  ) : null;

  return (
    <>
      {hasPreview ? (
        previewVariant === "course-thumbnail" ? (
          <div className="mt-4 rounded-[18px] border border-[#e3efe9] bg-[#f6fbf8] p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#087f5b]">Actual learner card preview</p>
            <div className="mt-4 overflow-hidden rounded-[18px] bg-[var(--ve-card)] shadow-sm">
              <div className="h-28 bg-[#dff2e9]">
                {previewImage}
              </div>
              <div className="p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#087f5b]">
                  {previewEyebrow || "Values Education"}
                </p>
                <h4 className="mt-2 text-lg font-black leading-6">
                  {previewTitle || "Course title"}
                </h4>
                <p className="mt-2 line-clamp-3 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
                  {previewDescription || "Short learner-facing course description."}
                </p>
                <p className="mt-3 text-[11px] font-black text-[var(--ve-muted)]">
                  {(previewMinutes ?? 0)} min from lessons
                </p>
              </div>
            </div>
          </div>
        ) : previewVariant === "course-cover" ? (
          <div className="mt-4 rounded-[18px] border border-[var(--ve-line-soft)] bg-[var(--ve-card-subtle)] p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#087f5b]">Live course hero preview</p>
            <div className="mt-4 overflow-hidden rounded-[18px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)]">
              <div className="h-40 bg-[#dff2e9]">
                {previewImage}
              </div>
              <div className="p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#087f5b]">
                  {previewEyebrow || "Values Education"}
                </p>
                <h4 className="mt-2 text-xl font-black leading-7">
                  {previewTitle || "Course title"}
                </h4>
                <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
                  {previewDescription || "Short learner-facing course description."}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-[16px] border border-[var(--ve-line-soft)] bg-[var(--ve-card-subtle)]">
            <div className="h-48 w-full">
              {previewImage}
            </div>
          </div>
        )
      ) : (
        <div className="mt-4 rounded-[16px] border border-dashed border-[var(--ve-line-soft)] bg-[var(--ve-card-subtle)] px-4 py-6 text-sm font-semibold text-[var(--ve-muted)]">
          Paste an image URL to preview and position it here before saving.
        </div>
      )}

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <label>
          <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">URL</span>
          <input
            className="mt-2 w-full rounded-[12px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 py-2 text-sm font-bold"
            name="url"
            onChange={(event) => setUrl(event.target.value)}
            value={url}
          />
        </label>
        <label>
          <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">Alt text</span>
          <input
            className="mt-2 w-full rounded-[12px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 py-2 text-sm font-bold"
            name="altText"
            onChange={(event) => setAltText(event.target.value)}
            value={altText}
          />
        </label>
        <label>
          <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">Image fit</span>
          <select
            className="mt-2 w-full rounded-[12px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 py-2 text-sm font-bold"
            name="imageFit"
            onChange={(event) => setFit(normalizeImageFit(event.target.value))}
            value={fit}
          >
            <option value="cover">Cover</option>
            <option value="contain">Contain</option>
          </select>
        </label>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label>
          <span className="flex items-center justify-between text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">
            <span>Horizontal focus</span>
            <span>{positionX}%</span>
          </span>
          <input
            className="mt-2 w-full"
            max={100}
            min={0}
            name="imagePositionX"
            onChange={(event) => setPositionX(normalizeImagePosition(Number(event.target.value), 50))}
            type="range"
            value={positionX}
          />
        </label>
        <label>
          <span className="flex items-center justify-between text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">
            <span>Vertical focus</span>
            <span>{positionY}%</span>
          </span>
          <input
            className="mt-2 w-full"
            max={100}
            min={0}
            name="imagePositionY"
            onChange={(event) => setPositionY(normalizeImagePosition(Number(event.target.value), 50))}
            type="range"
            value={positionY}
          />
        </label>
      </div>
    </>
  );
}
