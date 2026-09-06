"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMediaPicker } from '@/components/admin/MediaPickerProvider';
import { setCourseArtwork } from '@/app/admin/courses/ai/course-artwork-actions';
import { aiButton } from './AiPageResult';
type Artwork = {src?: string; alt?: string} | null;
export function AiCourseArtwork({courseId,thumbnail,cover}:{courseId:string;thumbnail?:Artwork;cover?:{url:string|null;alt_text:string|null}|null}) {
  const [error,setError]=useState('');const [busy,setBusy]=useState(false);const router=useRouter();const {requestMedia}=useMediaPicker();
  async function choose(target:'course_thumbnail'|'course_cover') {
    setError('');setBusy(true);
    try {
      const picked=await requestMedia({title:'Choose an image',placementLabel:target==='course_cover'?'Course cover':'Course thumbnail',
        initialUrl:target==='course_cover'?cover?.url??'':thumbnail?.src??'',initialAltText:target==='course_cover'?cover?.alt_text??'':thumbnail?.alt??'',
        imageTarget:{target,targetId:courseId},imageDraft:{beforeAction:async()=>0,onApplied:()=>{router.refresh();}},
        uploadContext:{assetType:'image',courseId,placement:target}});
      if(picked&&!picked.alreadyApplied){const form=new FormData();form.set('courseId',courseId);form.set('target',target);form.set('url',picked.url);await setCourseArtwork(form);router.refresh();}
    } catch(e){setError(e instanceof Error?e.message:'Artwork could not be saved.');}finally{setBusy(false);}
  }
  return <section className="space-y-4 rounded-2xl border border-[var(--admin-border-warm)] p-5" id="course-artwork"><h2 className="font-bold">Course thumbnail and cover</h2>
    <p className="text-sm">Choose images here, then review them with the course.</p>
    {error&&<p role="alert">{error}</p>}
    {(['course_thumbnail','course_cover'] as const).map(target=><div key={target} className="flex flex-wrap items-center gap-3"><span className="text-sm">{target==='course_cover'?(cover?.url?'Cover selected':'Cover needed'):(thumbnail?.src?'Thumbnail selected':'Thumbnail needed')}</span><button type="button" className={aiButton} disabled={busy} onClick={()=>void choose(target)}>Choose {target==='course_cover'?'course cover':'course thumbnail'}</button></div>)}
  </section>;
}
