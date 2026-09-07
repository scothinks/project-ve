import type { CourseResult } from './course-contracts.ts';
export type CoursePrice = {
  kind: 'course_outline' | 'course_draft'; estimatedUnits: number; outlineUnits: number; draftUnits: number;
  lessonCount: number; unfinishedCount: number; questionsPerLesson: number; metered: boolean; workspaceId: string | null;
};
export function pricedAction(label: string, price: Pick<CoursePrice, 'metered' | 'estimatedUnits'> | null) {
  return price ? `${label} · ${price.metered ? `${price.estimatedUnits} credits` : '0 credits'}` : label;
}
export function quoteMatchesPrice(quote: CourseResult & { workspaceId?: string | null }, price: CoursePrice) {
  return quote.stage === 'quote' && quote.kind === price.kind && quote.estimatedUnits === price.estimatedUnits
    && quote.metered === price.metered && quote.workspaceId === price.workspaceId && quote.totalCount === price.lessonCount
    && quote.totalCount - quote.completedCount === price.unfinishedCount
    && (quote.kind === 'course_outline' || quote.questionsPerLesson === price.questionsPerLesson);
}
