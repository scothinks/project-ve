"use client";
import Image, { type ImageProps } from "next/image";
import { useState } from "react";
/** Private media must go directly through the caller's authorised endpoint. */
export default function MediaImage(props: ImageProps) {
  const managed = typeof props.src === "string" && props.src.startsWith("/api/media/");
  const [failedSrc, setFailedSrc] = useState<ImageProps["src"] | null>(null);
  if (managed && failedSrc === props.src) return <span role="img" aria-label="Media unavailable" className="flex h-full min-h-16 items-center justify-center bg-[var(--ui-surface-muted)] p-3 text-sm text-[var(--ui-text-muted)]">Media unavailable</span>;
  return <Image {...props} alt={props.alt} unoptimized={managed || props.unoptimized} onError={(event) => { setFailedSrc(props.src); props.onError?.(event); }} />;
}
