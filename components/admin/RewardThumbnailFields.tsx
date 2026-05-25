"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { RewardThumbnailVisual } from "@/components/rewards/RewardThumbnailVisual";
import { rewardIconOptions } from "@/lib/reward-icons";
import { searchTablerIcons } from "@/lib/tabler-icon-catalog";
import type { RewardThumbnail } from "@/lib/rewards";

type RewardThumbnailFieldsProps = {
  color: string;
  iconName: string;
  legacyIcon?: string;
  title: string;
  url?: string;
  showUrl?: boolean;
};

function fieldClasses() {
  return "mt-1 w-full rounded-[12px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 py-2 text-sm font-semibold outline-none focus:border-[var(--ve-green)]";
}

function labelClasses() {
  return "text-xs font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]";
}

function normalizePickerColor(value: string, fallback = "#f4fbf7") {
  return /^#[0-9a-fA-F]{6}$/.test(value.trim()) ? value.trim() : fallback;
}

export function RewardThumbnailFields({
  color,
  iconName,
  legacyIcon = "",
  title,
  url = "",
  showUrl = true,
}: RewardThumbnailFieldsProps) {
  const previewId = useId();
  const initialSelection = iconName || (legacyIcon ? "legacy-text" : "");
  const [selectedIcon, setSelectedIcon] = useState(initialSelection);
  const [previewColor, setPreviewColor] = useState(color);
  const [previewUrl, setPreviewUrl] = useState(url);
  const [query, setQuery] = useState("");
  const [showAllIcons, setShowAllIcons] = useState(false);
  const [searchSelection, setSearchSelection] = useState("");
  const pickerColor = useMemo(() => normalizePickerColor(previewColor), [previewColor]);

  const previewThumbnail = useMemo<RewardThumbnail>(() => {
    if (selectedIcon === "legacy-text" && legacyIcon) {
      return { icon: legacyIcon, color: previewColor, url: previewUrl };
    }

    if (selectedIcon) {
      return { iconSet: "tabler", iconName: selectedIcon, color: previewColor, url: previewUrl };
    }

    return { color: previewColor, url: previewUrl };
  }, [legacyIcon, previewColor, previewUrl, selectedIcon]);

  const allIconMatches = useMemo(() => {
    if (!showAllIcons) {
      return [];
    }

    if (!query.trim()) {
      return [];
    }

    return searchTablerIcons(query, 16).filter(
      (option) => !rewardIconOptions.some((recommended) => recommended.value === option.value),
    );
  }, [query, showAllIcons]);

  useEffect(() => {
    setSearchSelection("");
  }, [query]);

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_8.5rem]">
      <div className="space-y-4">
        <input name="thumbnailLegacyIcon" type="hidden" value={legacyIcon} />
        <input
          name="thumbnailIconSet"
          type="hidden"
          value={selectedIcon && selectedIcon !== "legacy-text" ? "tabler" : ""}
        />
        <input
          name="thumbnailUseLegacyIcon"
          type="hidden"
          value={selectedIcon === "legacy-text" ? "true" : "false"}
        />
        <input
          name="thumbnailIconName"
          type="hidden"
          value={selectedIcon && selectedIcon !== "legacy-text" ? selectedIcon : ""}
        />

        <div className="grid gap-4 md:grid-cols-3">
          <label>
            <span className={labelClasses()}>Recommended icon</span>
            <select
              className={fieldClasses()}
              onChange={(event) => setSelectedIcon(event.target.value)}
              value={selectedIcon}
            >
              <option value="">No icon</option>
              {legacyIcon ? <option value="legacy-text">Legacy text ({legacyIcon})</option> : null}
              {rewardIconOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={labelClasses()}>Thumbnail color</span>
            <div className="mt-1 flex gap-2">
              <input
                aria-label="Pick thumbnail color"
                className="h-[46px] w-14 rounded-[12px] border border-[var(--ve-line)] bg-[var(--ve-card)] p-1"
                onChange={(event) => setPreviewColor(event.target.value)}
                type="color"
                value={pickerColor}
              />
              <input
                className={`${fieldClasses()} mt-0 flex-1`}
                maxLength={32}
                name="thumbnailColor"
                onChange={(event) => setPreviewColor(event.target.value)}
                value={previewColor}
              />
            </div>
          </label>
          {showUrl ? (
            <label className="md:col-span-1">
              <span className={labelClasses()}>Thumbnail URL</span>
              <input
                className={fieldClasses()}
                maxLength={1000}
                name="thumbnailUrl"
                onChange={(event) => setPreviewUrl(event.target.value)}
                value={previewUrl}
              />
            </label>
          ) : null}
        </div>

        <div className="rounded-[14px] border border-[var(--ve-line-soft)] bg-[var(--ve-shell)] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-black text-[var(--foreground)]">Need another icon?</p>
              <p className="mt-1 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
                Search the full Tabler library only when the recommended list is not enough.
              </p>
            </div>
            <button
              className="rounded-full bg-[var(--ve-card)] px-3 py-2 text-xs font-black text-[var(--ve-green)]"
              onClick={() => setShowAllIcons((value) => !value)}
              type="button"
            >
              {showAllIcons ? "Hide search" : "Search full library"}
            </button>
          </div>
        </div>

        {showAllIcons ? (
          <div className="rounded-[14px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] p-4">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_14rem]">
              <label>
                <span className={labelClasses()}>Search full library</span>
                <input
                  className={fieldClasses()}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="gift, wifi, certificate..."
                  value={query}
                />
              </label>
              <label>
                <span className={labelClasses()}>Search matches</span>
                <select
                  className={fieldClasses()}
                  disabled={!query.trim()}
                  onChange={(event) => {
                    if (event.target.value) {
                      setSearchSelection(event.target.value);
                      setSelectedIcon(event.target.value);
                    }
                  }}
                  value={searchSelection}
                >
                  <option value="">
                    {query.trim() ? "Select a matching icon" : "Type to search"}
                  </option>
                  {allIconMatches.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label} ({option.value})
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {!query.trim() ? (
              <p className="mt-3 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
                Search by icon name. Example: `gift`, `coffee`, `certificate`, `wifi`, `flag`.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="rounded-[14px] border border-[var(--ve-line-soft)] bg-[var(--ve-shell)] p-3">
        <p className={labelClasses()}>Preview</p>
        <div
          aria-describedby={previewId}
          className="mt-3 aspect-square overflow-hidden rounded-[18px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)]"
        >
          <RewardThumbnailVisual
            className="text-[var(--ve-green)]"
            defaultColor={previewColor || "#f4fbf7"}
            iconClassName="h-[52%] w-[52%] text-[var(--ve-green)]"
            textClassName="text-sm font-black text-[var(--ve-green)]"
            thumbnail={previewThumbnail}
            title={title}
          />
        </div>
        <p className="mt-2 text-xs font-semibold leading-5 text-[var(--ve-muted)]" id={previewId}>
          Uploaded image still takes priority over the icon.
        </p>
      </div>
    </div>
  );
}
