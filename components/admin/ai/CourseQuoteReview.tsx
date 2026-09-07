'use client';
import { useEffect, useState } from 'react';
import { AdminCard } from '@/components/admin/AdminPrimitives';
import type { CourseResult } from '@/features/ai-generation/authoring/course-contracts';
import { pricedAction } from '@/features/ai-generation/authoring/course-pricing';
import { aiButton, aiPrimary } from './AiPageResult';

// Only shown for reopened intents or changed scope/price. Normal generation
// goes directly from the visible priced action to progress.
export function CourseQuoteReview({ result, enabled, busy, onStart, onRefresh, onEdit }: {
  result: CourseResult; enabled: boolean; busy: boolean; onStart: () => void; onRefresh: () => void; onEdit?: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const expired = Date.parse(result.quoteExpiresAt) <= now;
  return <AdminCard className="space-y-4"><section aria-label="Review generation request" className="space-y-4">
    <h2 className="text-xl font-bold">Review this request before generating</h2>
    <p className="text-sm">{result.kind === 'course_outline' ? `${result.brief.lessonCount} planned lessons · one editable outline` : `${result.totalCount - result.completedCount} lessons to draft · ${result.questionsPerLesson} questions per lesson`}</p>
    <p className="text-sm">{result.kind === 'course_outline' ? result.brief.need : result.outline?.title}</p><p className="text-sm">For: {result.brief.audience}</p>
    <p className="text-sm">{result.metered ? `${result.estimatedUnits} credits for this request. ${result.kind === 'course_outline' ? 'Full course drafting is a separate charge.' : 'Already completed lessons are retained.'}` : 'Platform Catalog · No organisation credits used.'}</p>
    {expired && <p role="status" className="text-sm">This request’s price has expired. Refresh it, then review and generate.</p>}
    <div className="flex flex-wrap gap-3"><button type="button" className={aiPrimary} disabled={busy || !enabled || expired} onClick={onStart}>{pricedAction(result.kind === 'course_outline' ? 'Generate outline' : 'Generate course draft', result)}</button><button type="button" className={aiButton} disabled={busy || !enabled} onClick={onRefresh}>Refresh request</button>{onEdit && <button type="button" className={aiButton} disabled={busy} onClick={onEdit}>Edit brief</button>}</div>
  </section></AdminCard>;
}
