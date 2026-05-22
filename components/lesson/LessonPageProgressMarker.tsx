"use client";

import { useEffect } from "react";

type LessonPageProgressMarkerProps = {
  lessonId: string;
  pageId: string;
};

export function LessonPageProgressMarker({ lessonId, pageId }: LessonPageProgressMarkerProps) {
  useEffect(() => {
    void fetch("/api/lesson-progress", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ lessonId, pageId }),
    });
  }, [lessonId, pageId]);

  return null;
}
