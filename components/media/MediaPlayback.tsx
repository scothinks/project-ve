"use client";
import { useEffect, useRef, useState, type ComponentProps, type Ref, type RefObject } from "react";

function useMediaErrorReplay<T extends HTMLMediaElement>(src: ComponentProps<"video">["src"]) {
  const ref = useRef<T>(null);
  useEffect(() => {
    // Native preload may fail before React hydrates and attaches onError.
    // Replay that existing error after mount, as well as on source changes.
    if (ref.current?.error) ref.current.dispatchEvent(new Event("error"));
  }, [src]);
  return ref;
}

function mediaRef<T>(internal: RefObject<T | null>, forwarded: Ref<T> | undefined) {
  return (element: T | null) => {
    internal.current = element;
    if (typeof forwarded === "function") return forwarded(element);
    if (forwarded) forwarded.current = element;
  };
}

export function MediaVideo(props: ComponentProps<"video">) {
  const [failed, setFailed] = useState<ComponentProps<"video">["src"]>();
  const ref = useMediaErrorReplay<HTMLVideoElement>(props.src);
  if (failed === props.src && failed) return <p role="status">Video unavailable.</p>;
  return <video {...props} className={`aspect-video w-full bg-black object-contain ${props.className ?? ""}`} ref={mediaRef(ref, props.ref)} onError={e => { setFailed(props.src); props.onError?.(e); }} />;
}
export function MediaAudio(props: ComponentProps<"audio">) {
  const [failed, setFailed] = useState<ComponentProps<"audio">["src"]>();
  const ref = useMediaErrorReplay<HTMLAudioElement>(props.src);
  if (failed === props.src && failed) return <p role="status">Audio unavailable.</p>;
  return <audio {...props} ref={mediaRef(ref, props.ref)} onError={e => { setFailed(props.src); props.onError?.(e); }} />;
}
