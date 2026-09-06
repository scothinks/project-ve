export type PageCandidate = Partial<import("./page-assistant").PageAdvice> & {
  title: string;
  subtitle: string;
  pageType: "concept" | "scenario" | "reflection" | "summary";
  blocks: Array<{ blockType: "text" | "callout" | "table" | "image" | "video" | "audio"; payload: Record<string, unknown> }>;
};

export type ApplicationReceipt = {
  status: "saved";
  pageId: string;
  lessonId: string;
  draftRevision: number;
  savedAt: string;
  page?: import("@/lib/admin").AdminLessonPageRow;
  blocks?: import("@/lib/admin").AdminLessonBlockRow[];
};

export type AuthoringResult = {
  id: string;
  kind?: "page" | "quiz" | "lesson_plan" | "lesson_draft" | "course_outline" | "course_draft" | "image";
  lessonId: string;
  courseId: string;
  title: string;
  stage: "quote" | "starting" | "writing" | "ready" | "failed" | "stopped";
  createdAt: string;
  updatedAt: string;
  sourceRevision: number;
  position: number;
  pageType: PageCandidate["pageType"] | "auto";
  assistant?: boolean;
  focus: string;
  refinement: string;
  parentId: string | null;
  estimatedUnits: number;
  metered: boolean;
  quoteExpiresAt: string;
  stopRequested: boolean;
  candidate: PageCandidate | null;
  receipt: ApplicationReceipt | null;
  applicationState: "not_started" | "checking" | "saved" | "not_saved";
  applicationError: string | null;
  credit: { status?: string; used?: number; reserved?: number; released?: number };
  failure: string | null;
  deleted: boolean;
  targetAvailable: boolean;
};

export type AuthoringResults = { items: AuthoringResult[]; unusedCount: number };

export function isGenerating(result: AuthoringResult) {
  return result.stage === "starting" || result.stage === "writing";
}

export function resultLabel(result: AuthoringResult) {
  if (result.receipt) return "Added";
  if (result.kind && result.kind !== "page") {
    if (result.stopRequested && isGenerating(result)) return "Stopping…";
    return { quote: "Check the cost", starting: "Request accepted", writing: result.kind === "image" ? "Creating your image" : result.kind === "course_outline" ? "Planning your course" : result.kind === "course_draft" ? "Writing lessons" : result.kind === "quiz" ? "Writing and checking questions" : result.kind === "lesson_plan" ? "Planning lessons" : "Writing your lesson", ready: "Not added yet", failed: "Needs attention", stopped: "Stopped" }[result.stage];
  }
  if (result.candidate?.decision === "review_quiz") return "Ready to review the quiz";
  if (result.assistant && !result.stopRequested) {
    if (result.stage === "starting") return "Preparing to review your lesson";
    if (result.stage === "writing") return "Considering what would help next";
    if (result.stage === "ready") return "Suggested next page";
  }
  if (result.stopRequested && isGenerating(result)) return "Stopping…";
  return { quote: "Check the cost", starting: "Preparing your page", writing: "Writing your page", ready: "Not added yet", failed: "Needs attention", stopped: "Stopped" }[result.stage];
}

export function creditLabel(result: AuthoringResult) {
  if (!result.metered) return "Platform catalogue · No organisation credits used";
  if (result.credit.status === "charged") return `${result.credit.used ?? result.estimatedUnits} credits used${result.credit.released ? ` · ${result.credit.released} credits released` : ""}`;
  if (result.credit.status === "released") return `${result.credit.released ?? result.estimatedUnits} credits released`;
  return `${result.credit.reserved ?? result.estimatedUnits} credits reserved · Final usage will appear here`;
}
