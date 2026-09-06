export type LegacyBrief = {id:string;lessonId:string|null;title:string;kind:string;brief:string;url:string|null;alt:string|null;review:string;status:string;reason:string|null;targetKind:string|null;targetId:string|null;provenance:{source:string;provider:string|null;model:string|null}};
export type LegacyDestination = {kind:string;id:string;lessonId:string;pageId?:string;label:string};
export type LegacyJob = {id:string;status:string;createdAt:string;decision:string|null;attempted:boolean;creditStatus:string;reserved:number|null;charged:number|null;released:number|null};
export type LegacyMediaWorkspace = {briefs:LegacyBrief[];destinations:LegacyDestination[];jobs:LegacyJob[]};
export function legacyMediaHref(courseId:string,brief:LegacyBrief,destinations:LegacyDestination[]) {
  if(brief.status!=='mapped')return `/admin/courses/${encodeURIComponent(courseId)}/media#brief-${brief.id}`;
  if(brief.targetKind?.startsWith('course_'))return `/admin/courses/${encodeURIComponent(courseId)}/review#course-artwork`;
  const destination=destinations.find(d=>d.kind===brief.targetKind&&d.id===brief.targetId);
  if(!destination)return `/admin/courses/${encodeURIComponent(courseId)}/media#brief-${brief.id}`;
  const base=`/admin/courses/lessons/${encodeURIComponent(destination.lessonId)}`;
  if(brief.targetKind==='block')return `${base}?page=${encodeURIComponent(destination.pageId??'')}#block-${brief.targetId}`;
  if(brief.targetKind==='page_cover')return `${base}?page=${encodeURIComponent(brief.targetId??'')}`;
  return `${base}/preview?section=review`;
}
