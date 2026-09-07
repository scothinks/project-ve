'use client';
import { pricedAction, type CoursePrice } from '@/features/ai-generation/authoring/course-pricing';
import { useCoursePrice } from './useCoursePrice';
import { aiButton, aiPrimary } from './AiPageResult';

export function CourseGenerateAction({ kind, lessons, questions = 0, retryId, enabled, busy, valid = true, label, onGenerate }: {
  kind: CoursePrice['kind']; lessons: number; questions?: number; retryId?: string; enabled: boolean; busy: boolean; valid?: boolean;
  label: string; onGenerate: (price: CoursePrice) => void;
}) {
  const { price, error, refresh } = useCoursePrice(kind, lessons, questions, retryId, enabled);
  return <div className="space-y-3">
    {(!price || price.metered) && <p className="text-sm leading-6">{!price ? enabled ? error ? 'The price could not be loaded.' : 'Preparing the price for this scope…' : 'Generation is unavailable. Your saved results remain accessible.'
      : kind === 'course_outline' ? `${price.outlineUnits} credits for one editable outline. Drafting ${price.lessonCount} lessons without quizzes costs ${price.draftUnits} more; ${price.outlineUnits + price.draftUnits} in total if you request both.`
          : `${price.unfinishedCount} lesson${price.unfinishedCount === 1 ? '' : 's'} to draft · ${price.questionsPerLesson} questions per lesson. ${retryId ? 'Completed lessons are kept. This price includes a new request base.' : 'The outline charge is separate.'}`}</p>}
    {error && <div role="status" className="space-y-2"><p className="text-sm">{error}</p><button type="button" className={aiButton} onClick={refresh}>Retry price lookup</button></div>}
    <button type="button" className={`${aiPrimary} w-full sm:w-auto`} disabled={busy || !enabled || !valid || !price} onClick={() => { if (price) onGenerate(price); }}>{busy ? 'Preparing your request…' : pricedAction(label, price)}</button>
    {price && <p className="text-xs leading-5">{kind === 'course_outline' ? 'Review the outline before drafting.' : 'Review before saving. Publishing is separate.'} Images are optional.</p>}
  </div>;
}
