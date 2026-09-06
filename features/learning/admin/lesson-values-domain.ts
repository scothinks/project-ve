export type LessonValueChoice = {
  dimensionId: string;
  weight: number;
  recommendedLevel: "beginner" | "intermediate" | "advanced" | null;
  outcomeType: "awareness" | "reflection" | "practice" | "action" | "assessment" | null;
};

export function parseLessonValueChoices(input: unknown): LessonValueChoice[] {
  if (!Array.isArray(input) || input.length > 100) throw new Error("Choose from the available values.");
  const seen = new Set<string>();
  return input.map((choice) => {
    if (!choice || typeof choice !== "object"
      || typeof choice.dimensionId !== "string" || !choice.dimensionId || choice.dimensionId.length > 120
      || seen.has(choice.dimensionId)
      || typeof choice.weight !== "number" || !Number.isFinite(choice.weight) || choice.weight < 0.1 || choice.weight > 1
      || ![null, "beginner", "intermediate", "advanced"].includes(choice.recommendedLevel)
      || ![null, "awareness", "reflection", "practice", "action", "assessment"].includes(choice.outcomeType)) {
      throw new Error("One of your value choices needs attention. Refresh the page and try again.");
    }
    seen.add(choice.dimensionId);
    return { dimensionId: choice.dimensionId, weight: choice.weight, recommendedLevel: choice.recommendedLevel, outcomeType: choice.outcomeType };
  });
}

export function lessonValueChoicesKey(choices: LessonValueChoice[]) {
  return JSON.stringify([...choices].sort((a, b) => a.dimensionId.localeCompare(b.dimensionId)));
}
