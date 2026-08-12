"use client";

import { useEffect } from "react";

type LessonPageProgressMarkerProps = {
  lessonId: string;
  pageId: string;
  programmeId?: string | null;
};

export function LessonPageProgressMarker({ lessonId, pageId, programmeId }: LessonPageProgressMarkerProps) {
  useEffect(() => {
    void fetch("/api/lesson-progress", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ lessonId, pageId, programmeId: programmeId ?? null }),
    });
  }, [lessonId, pageId, programmeId]);

  return null;
}
