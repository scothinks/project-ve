'use client';
import { useState } from 'react';
import { AdminDrawer } from '@/components/admin/AdminDialog';
import type { CoursePrice } from '@/features/ai-generation/authoring/course-pricing';
import { pricedAction } from '@/features/ai-generation/authoring/pricing-labels';
import { courseField } from './AiCourseOutlineEditor';
import { aiButton } from './AiPageResult';
import { CourseGenerateAction } from './CourseGenerateAction';

export function CourseRefineAction({ lessons, enabled, busy, error, onRefine, price = null }: {
  lessons: number; enabled: boolean; busy: boolean; error: string;
  price?: { metered: boolean; estimatedUnits: number } | null;
  onRefine: (direction: string, price: CoursePrice) => void;
}) {
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState('');
  return <AdminDrawer open={open} onOpenChange={setOpen} title="Refine your outline"
    description="Describe what to change. Your earlier outline and completed drafts stay available."
    trigger={<button type="button" className={aiButton} disabled={busy || !enabled}>{pricedAction('Refine', price, '-')}</button>}>
    <div className="space-y-4">
      <label className="block text-sm font-bold">Refinement direction<textarea autoFocus className={courseField} rows={4} maxLength={1000} disabled={busy} value={direction} onChange={e => setDirection(e.target.value)} /></label>
      {error && <p role="alert" className="text-sm">{error}</p>}
      <CourseGenerateAction kind="course_outline" lessons={lessons} enabled={enabled && open} busy={busy}
        valid={!!direction.trim()} label="Refine" separator="-" onGenerate={price => onRefine(direction, price)} />
    </div>
  </AdminDrawer>;
}
