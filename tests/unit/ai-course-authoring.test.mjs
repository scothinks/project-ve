import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import test from 'node:test';
const hooks=registerHooks({resolve(specifier,context,next){
 if(specifier==='server-only')return {shortCircuit:true,url:'data:text/javascript,export {}'};
 if(specifier==='@/lib/app-errors')return {shortCircuit:true,url:'data:text/javascript,export const logAppError=()=>{};'};
 if(specifier.startsWith('@/')){const p=path.resolve(specifier.slice(2));const file=['','.ts'].map(e=>p+e).find(existsSync);if(file)return {shortCircuit:true,url:pathToFileURL(file).href};}
 return next(specifier,context);
}});
const {validateCourseOutline,validateCourseLesson}=await import('../../features/ai-generation/authoring/course-validation.ts');
const {processAuthoringCourse}=await import('../../features/ai-generation/authoring/course-worker.ts');
const {generateCourseCheckpoint,courseSchema}=await import('../../features/ai-generation/authoring/course-provider.ts');
const {courseTeachingContext}=await import('../../features/ai-generation/authoring/course-teaching.ts');
const {listeningLesson,comparisonLesson}=await import('../support/course-teaching-fixtures.ts');
hooks.deregister();
const outline={title:'Listen together',description:'Learn to decide fairly.',lessons:[{title:'Listen first',description:'Hear everyone.'},{title:'Choose fairly',description:'Compare effects.'}]};
const context={kind:'course_draft',brief:{need:'Fair choices',audience:'Adults',tone:'Direct',lessonCount:2},outline,questionsPerLesson:0,refinement:'',priorDraft:null,index:0};
const lesson={title:'Listen first',description:'Hear everyone.',pages:[{title:'Listen',subtitle:'',pageType:'concept',blocks:[{blockType:'text',payload:{body:'<p>Hear everyone.</p>'}},{blockType:'image',payload:{mediaIntent:{version:1,kind:'image',purpose:'Show a listening circle',aspectRatio:'16:9',required:false,style:'inherit'}}}]}],questions:[]};
test('one bounded editable outline, distinct titles and explicit quiz scope',()=>{
 assert.deepEqual(validateCourseOutline(outline,2),outline);
 assert.throws(()=>validateCourseOutline(outline,3));
 assert.throws(()=>validateCourseOutline({...outline,lessons:[outline.lessons[0],outline.lessons[0]]}));
 assert.throws(()=>validateCourseLesson(lesson,{...context,questionsPerLesson:1}),/accepted scope/);
 assert.equal(validateCourseLesson(lesson,context).pages[0].blocks[1].payload.src,'');
 assert.equal(courseSchema('course_outline').additionalProperties,false);
 assert.ok(courseSchema('course_draft').properties.questions);
});
test('course worker persists each result and retries only the index supplied by the durable operation',async()=>{
 const calls=[];let reads=0;
 const client={rpc:async(name,args)=>{calls.push(args.p_action);return {data:args.p_action==='begin'?{...context,index:1}: {done:true},error:null};}};
 const job={id:crypto.randomUUID(),lock_token:crypto.randomUUID(),lock_version:1};
 const result=await processAuthoringCourse(client,job,'test',async c=>{reads++;assert.equal(c.index,1);return {...lesson,title:'Choose fairly'};});
 assert.equal(result.status,'completed');assert.equal(reads,1);assert.deepEqual(calls,['begin','checkpoint']);
 let provider=0;
 const uncertain={rpc:async(name,args)=>({data:{done:true},error:args.p_action==='begin'?new Error('uncertain'):null})};
 assert.equal((await processAuthoringCourse(uncertain,job,'test',async()=>{provider++;return lesson;})).status,'failed');
 assert.equal(provider,0);
});
test('provider uses one text request, configured model and explicit no-quiz scope',async()=>{
 const old=globalThis.fetch, key=process.env.OPENAI_API_KEY;process.env.OPENAI_API_KEY=crypto.randomUUID();let calls=0;
 globalThis.fetch=async(url,init)=>{calls++;assert.equal(url,'https://api.openai.com/v1/responses');const b=JSON.parse(init.body);assert.equal(b.store,false);assert.equal(b.text.format.strict,true);assert.match(b.input[0].content,/exactly 0 single-choice/);return Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(lesson)}]}]});};
 try {await generateCourseCheckpoint(context);assert.equal(calls,1);} finally {globalThis.fetch=old;if(key===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=key;}
});
test('contrasting teaching compositions remain intact; cosmetic copies and unsupported structures fail',()=>{
 const first=validateCourseLesson(listeningLesson,context);
 const nextContext={...context,index:1,completed:[{index:0,lesson:first}]};
 const second=validateCourseLesson(comparisonLesson,nextContext);
 assert.deepEqual(first,listeningLesson);
 assert.deepEqual(second,comparisonLesson);
 assert.deepEqual(second.pages.map(p=>p.pageType),['concept','reflection']);
 assert.deepEqual(second.pages[0].blocks[1].payload.rows,comparisonLesson.pages[0].blocks[1].payload.rows);
 const copy=structuredClone(first);copy.title='Choose fairly';copy.pages.forEach(p=>{p.title='Different heading';p.subtitle='Renamed';p.pageType='summary';});
 assert.throws(()=>validateCourseLesson(copy,nextContext),/repeats completed teaching/);
 const reusedLayout=structuredClone(first);reusedLayout.pages[0].blocks[0].payload.body='<p>Use recorded constraints to compare Saturday with evening meetings.</p>';
 assert.doesNotThrow(()=>validateCourseLesson(reusedLayout,nextContext));
 const invalid=structuredClone(second);invalid.pages[0].blocks[1].payload.rows[0].pop();
 assert.throws(()=>validateCourseLesson(invalid,nextContext),/item count/);
 assert.throws(()=>validateCourseLesson({...second,pages:[{...second.pages[0],pageType:'simulation'}]},nextContext),/page type/);
 assert.throws(()=>validateCourseLesson({...second,pages:[{...second.pages[0],blocks:[{blockType:'interactive_game',payload:{}}]}]},nextContext),/Unsupported/);
});
test('later provider requests retain accepted progression and bounded actual teaching across recovery',async()=>{
 const old=globalThis.fetch,key=process.env.OPENAI_API_KEY;process.env.OPENAI_API_KEY=crypto.randomUUID();
 const next={...context,index:1,completed:[{index:0,lesson:listeningLesson}]};let request;
 globalThis.fetch=async(url,init)=>{request=JSON.parse(init.body);return Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(comparisonLesson)}]}]});};
 try {
  assert.deepEqual(await generateCourseCheckpoint(next),comparisonLesson);
  const sent=JSON.parse(request.input[1].content);
  assert.deepEqual(sent.brief,context.brief);assert.deepEqual(sent.outline,outline);assert.deepEqual(sent.targetLesson,outline.lessons[1]);
  assert.match(sent.completedLessons[0].pages[0].teachingExcerpt,/Ask what makes attendance difficult/);
  assert.deepEqual(sent.completedLessons[0].pages.map(p=>p.pageType),['concept','scenario']);
  assert.ok(sent.completedLessons[0].pages.every(p=>p.teachingExcerpt.length<=600));
  assert.equal('completed' in sent,false);
  assert.match(request.input[0].content,/not a checklist/);
  const long=structuredClone(listeningLesson);long.pages[0].blocks[0].payload.body='Context '.repeat(700);
  assert.equal(courseTeachingContext({...next,completed:[{index:0,lesson:long}]}).completedLessons[0].pages[0].teachingExcerpt.length,600);
 }finally {globalThis.fetch=old;if(key===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=key;}
});
