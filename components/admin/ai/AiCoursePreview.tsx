"use client";
import { LessonPageCard } from '@/components/lesson/LessonPageLayout';
import { mapPreviewBlock } from '@/features/learning/admin/lesson-page-builder-domain';
import type { CourseResult } from '@/features/ai-generation/authoring/course-contracts';
export function AiCoursePreview({ result }: { result: CourseResult }) {
  return <section aria-label="Completed lesson previews" className="space-y-5">{[...(result.candidate?.completed ?? [])].sort((a,b)=>a.index-b.index).map(({index,lesson},position)=><details key={index} className="rounded-2xl border border-[var(--admin-border-warm)] p-4" open={position===0}>
    <summary className="cursor-pointer font-bold">Lesson {index+1}: {lesson.title}<span className="ml-2 text-xs font-normal">{lesson.pages.length} pages · {lesson.questions.length} questions</span></summary><p className="my-3 text-sm">{lesson.description}</p>
    <div className="space-y-4">{lesson.pages.map((p,i)=><LessonPageCard key={i} isPreview title={p.title} subtitle={p.subtitle} pageType={p.pageType==='scenario'?'example':p.pageType}
      blocks={p.blocks.map((b,j)=>mapPreviewBlock({id:`${result.id}-${index}-${i}-${j}`,page_id:result.id,block_type:b.blockType,payload:b.payload,sort_order:j+1}))}/>)}</div>
    {lesson.questions.map((q,i)=><article key={i} className="mt-4 rounded-xl bg-[var(--admin-surface-container-low)] p-4 text-sm"><h4 className="font-bold">{q.prompt}</h4><ul className="my-3 space-y-2">{q.options.map((o,n)=><li key={n}>{o.label}{o.isCorrect&&<strong> · Correct answer</strong>}</li>)}</ul><p>{q.explanation}</p></article>)}
  </details>)}</section>;
}
