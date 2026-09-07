"use client";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState } from 'react';
import type { CourseOutline } from '@/features/ai-generation/authoring/course-contracts';
import { aiButton } from './AiPageResult';
export const courseField = 'mt-2 w-full rounded-xl border border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] p-3 text-sm font-normal focus-visible:outline-2 focus-visible:outline-offset-2';
function LessonRow({ id, lesson, index, count, disabled, change, move, remove }: { id: string; lesson: CourseOutline['lessons'][number]; index: number; count: number; disabled: boolean; change: (lesson: CourseOutline['lessons'][number]) => void; move: (to: number) => void; remove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id, disabled });
  return <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className="space-y-3 rounded-2xl border border-[var(--admin-border-warm)] p-4">
    <div className="flex flex-wrap items-center gap-2"><button type="button" {...attributes} {...listeners} className={aiButton} disabled={disabled} aria-label={`Drag lesson ${index+1}`}>↕</button><strong>Lesson {index+1}</strong>
      <button type="button" className={aiButton} disabled={disabled || index===0} onClick={()=>move(index-1)}>Move up</button><button type="button" className={aiButton} disabled={disabled || index===count-1} onClick={()=>move(index+1)}>Move down</button><button type="button" className={aiButton} disabled={disabled || count===1} onClick={remove}>Remove</button></div>
    <label className="block text-sm">Lesson title<input className={courseField} value={lesson.title} maxLength={180} disabled={disabled} onChange={e=>change({...lesson,title:e.target.value})}/></label>
    <label className="block text-sm">What it teaches<textarea className={courseField} value={lesson.description} maxLength={1000} disabled={disabled} onChange={e=>change({...lesson,description:e.target.value})}/></label>
  </li>;
}
export function AiCourseOutlineEditor({ value, onChange, disabled }: { value: CourseOutline; onChange: (outline: CourseOutline)=>void; disabled: boolean }) {
  const [ids,setIds]=useState(()=>value.lessons.map(()=>crypto.randomUUID()));
  const sensors=useSensors(useSensor(PointerSensor,{activationConstraint:{distance:8}}),useSensor(KeyboardSensor,{coordinateGetter:sortableKeyboardCoordinates}));
  const move=(from:number,to:number)=>{setIds(arrayMove(ids,from,to));onChange({...value,lessons:arrayMove(value.lessons,from,to)});};
  return <div className="space-y-4">
    <label className="block text-sm font-bold">Course title<input className={courseField} value={value.title} maxLength={180} disabled={disabled} onChange={e=>onChange({...value,title:e.target.value})}/></label>
    <label className="block text-sm font-bold">Course description<textarea className={courseField} value={value.description} maxLength={1000} disabled={disabled} onChange={e=>onChange({...value,description:e.target.value})}/></label>
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={({active,over})=>{if(over&&active.id!==over.id)move(ids.indexOf(String(active.id)),ids.indexOf(String(over.id)));}}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}><ol className="space-y-3">{value.lessons.map((lesson,index)=><LessonRow key={ids[index]} id={ids[index]} lesson={lesson} index={index} count={value.lessons.length} disabled={disabled}
        change={next=>onChange({...value,lessons:value.lessons.map((l,i)=>i===index?next:l)})} move={to=>move(index,to)} remove={()=>{setIds(ids.filter((_,i)=>i!==index));onChange({...value,lessons:value.lessons.filter((_,i)=>i!==index)});}} />)}</ol></SortableContext>
    </DndContext>
    <button type="button" className={aiButton} disabled={disabled||value.lessons.length>=6} onClick={()=>{setIds([...ids,crypto.randomUUID()]);onChange({...value,lessons:[...value.lessons,{title:'',description:''}]});}}>Add lesson</button>
  </div>;
}
