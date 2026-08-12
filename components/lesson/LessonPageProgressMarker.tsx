"use client";

import { useEffect } from "react";

type LessonPageProgressMarkerProps = {
  lessonId: string;
  organizationId?: string | null;
  pageId: string;
  programmeId?: string | null;
};

export function LessonPageProgressMarker({
  lessonId,
  organizationId,
  pageId,
  programmeId,
}: LessonPageProgressMarkerProps) {
  useEffect(() => {
    void fetch("/api/lesson-progress", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        lessonId,
        organizationId: organizationId ?? null,
        pageId,
        programmeId: programmeId ?? null,
      }),
    });
  }, [lessonId, organizationId, pageId, programmeId]);

  return null;
}
