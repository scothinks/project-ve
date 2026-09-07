'use client';
import { useEffect, useState } from 'react';
import type { CoursePrice } from '@/features/ai-generation/authoring/course-pricing';

export function useCoursePrice(kind: CoursePrice['kind'], lessons: number, questions: number, retryId?: string, enabled = true) {
  const key = `${kind}:${lessons}:${questions}:${retryId || ''}`;
  const [state, setState] = useState<{ key: string; price: CoursePrice | null; error: string }>({ key: '', price: null, error: '' });
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const abort = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ kind, lessons: String(lessons), questions: String(questions), ...(retryId ? { retryId } : {}) });
        const response = await fetch(`/api/admin/ai/course-pricing?${params}`, { cache: 'no-store', signal: abort.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Pricing is unavailable.');
        if (!abort.signal.aborted) setState({ key, price: data, error: '' });
      } catch (e) { if (!abort.signal.aborted) setState({ key, price: null, error: e instanceof Error ? e.message : 'Pricing is unavailable.' }); }
    }, 200);
    return () => { clearTimeout(timer); abort.abort(); };
  }, [key, kind, lessons, questions, retryId, enabled, refresh]);
  return { price: enabled && state.key === key ? state.price : null, error: enabled && state.key === key ? state.error : '', refresh: () => { setState({ key: '', price: null, error: '' }); setRefresh(n => n + 1); } };
}
