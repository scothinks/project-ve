import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type LearnerCompletionStatus = "in_progress" | "completed";

export type LearnerTranscriptItem = {
  id: string;
  title: string;
  kind: "course" | "programme";
  category?: string | null;
  organizationId?: string | null;
  status: LearnerCompletionStatus;
  progressPercent: number;
  completedAt: string | null;
  evaluatedAt: string | null;
  missingRequirements: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

export type LearnerTranscript = {
  generatedAt: string | null;
  courses: LearnerTranscriptItem[];
  programmes: LearnerTranscriptItem[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function completionStatus(value: unknown): LearnerCompletionStatus {
  return value === "completed" ? "completed" : "in_progress";
}

function progressPercent(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round(parsed)));
}

function objectOrEmpty(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function normalizeTranscriptItem(value: unknown, kind: "course" | "programme"): LearnerTranscriptItem | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = stringOrNull(kind === "course" ? value.courseId : value.programmeId);
  const title = stringOrNull(value.title);

  if (!id || !title) {
    return null;
  }

  return {
    category: stringOrNull(value.category),
    completedAt: stringOrNull(value.completedAt),
    evaluatedAt: stringOrNull(value.evaluatedAt),
    id,
    kind,
    metadata: objectOrEmpty(value.metadata),
    missingRequirements: objectOrEmpty(value.missingRequirements),
    organizationId: stringOrNull(value.organizationId),
    progressPercent: progressPercent(value.progressPercent),
    status: completionStatus(value.status),
    title,
  };
}

function normalizeTranscript(value: unknown): LearnerTranscript {
  if (!isRecord(value)) {
    return {
      courses: [],
      generatedAt: null,
      programmes: [],
    };
  }

  const courses = Array.isArray(value.courses)
    ? value.courses
      .map((item) => normalizeTranscriptItem(item, "course"))
      .filter((item): item is LearnerTranscriptItem => item !== null)
    : [];
  const programmes = Array.isArray(value.programmes)
    ? value.programmes
      .map((item) => normalizeTranscriptItem(item, "programme"))
      .filter((item): item is LearnerTranscriptItem => item !== null)
    : [];

  return {
    courses,
    generatedAt: stringOrNull(value.generatedAt),
    programmes,
  };
}

export async function getLearnerTranscript(
  supabase: SupabaseClient<Database>,
): Promise<LearnerTranscript> {
  const { data, error } = await supabase.rpc("get_my_lms_transcript");

  if (error) {
    throw error;
  }

  return normalizeTranscript(data);
}
