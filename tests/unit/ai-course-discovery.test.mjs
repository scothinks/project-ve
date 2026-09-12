import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { validateDiscoveryInput, validateDiscoveryAdvice, starterAdvice } from '../../features/ai-generation/authoring/course-discovery.ts';
import { quoteMatchesPrice, pricedAction } from '../../features/ai-generation/authoring/course-pricing.ts';
const input={seed:'Tolerance',answers:[],brief:{need:'Tolerance',audience:'A general audience',tone:'Conversational',lessonCount:3}};
test('uncertain authors get concrete goals and learner help without losing the original idea',()=>{
 const start=starterAdvice(input);assert.deepEqual(start.choices,['Disagree respectfully','Work across differences','Respond to exclusion']);
 const next=starterAdvice({...input,answers:[{question:start.question,answer:'Disagree respectfully'}]});
 assert.equal(next.brief.need,'Tolerance: Disagree respectfully');assert.match(next.question,/Where/);
 const summary=starterAdvice({...input,answers:[{question:start.question,answer:'Disagree respectfully'},{question:next.question,answer:'Not sure yet'}]});
 assert.equal(summary.question,'');assert.equal(summary.brief.audience,'A general audience');assert.ok(summary.suggestedFields.includes('audience'));
});
test('discovery bounds user context and schema without silent truncation',()=>{
 assert.deepEqual(validateDiscoveryInput(input),input);
 assert.throws(()=>validateDiscoveryInput({...input,seed:'x'.repeat(1201)}));
 assert.throws(()=>validateDiscoveryInput({...input,answers:Array(4).fill({question:'Where?',answer:'Work'})}));
 assert.throws(()=>validateDiscoveryAdvice({...starterAdvice(input),brief:{...input.brief,audience:'x'.repeat(501)}}));
 assert.throws(()=>validateDiscoveryAdvice({...starterAdvice(input),suggestedFields:['ethnicity']}));
 assert.throws(()=>validateDiscoveryAdvice({...starterAdvice(input),question:'',choices:['Unknown']}));
 const ownAudience='x'.repeat(500);
 const summary=starterAdvice({...input,answers:[{question:'Goal?',answer:'Listen'},{question:'Who?',answer:ownAudience}]});
 assert.equal(validateDiscoveryAdvice(summary).brief.audience,ownAudience);
});
test('a displayed quote must match price, tenant, lesson and quiz scope before start',()=>{
 const price={kind:'course_draft',estimatedUnits:182,lessonCount:2,unfinishedCount:2,questionsPerLesson:1,metered:true,workspaceId:'first'};
 const quote={stage:'quote',kind:'course_draft',estimatedUnits:182,totalCount:2,completedCount:0,questionsPerLesson:1,metered:true,workspaceId:'first'};
 assert.equal(quoteMatchesPrice(quote,price),true);
 for(const change of [{estimatedUnits:183},{totalCount:3},{completedCount:1},{questionsPerLesson:0},{workspaceId:'second'},{metered:false},{stage:'starting'}])assert.equal(quoteMatchesPrice({...quote,...change},price),false);
 assert.equal(pricedAction('Generate',{estimatedUnits:57,metered:true}),'Generate · 57 credits');
 assert.equal(pricedAction('Generate',{estimatedUnits:57,metered:false}),'Generate · 0 credits');
 assert.equal(pricedAction('Refine',{estimatedUnits:57,metered:true},'-'),'Refine - 57 credits');
 assert.equal(pricedAction('Generate course',{estimatedUnits:205,metered:true},'-'),'Generate course - 205 credits');
});
const hooks=registerHooks({resolve(specifier,context,next){if(specifier==='server-only')return{shortCircuit:true,url:'data:text/javascript,export {}'};return next(specifier,context);}});
const {generateCourseAdvice}=await import('../../features/ai-generation/authoring/course-discovery-provider.ts');hooks.deregister();
test('provider guidance is bounded, preserves chosen scope and stops asking after three answers',async()=>{
 const fetch=globalThis.fetch;let payload;
 globalThis.fetch=async(url,init)=>{assert.equal(url,'https://api.openai.com/v1/responses');payload=JSON.parse(init.body);return Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({...starterAdvice(input),brief:{...input.brief,tone:'Formal',lessonCount:6}})}]}]});};
 try{const advice=await generateCourseAdvice({...input,answers:Array(3).fill({question:'Where?',answer:'Work'})});assert.equal(payload.max_output_tokens,1800);assert.equal(payload.store,false);assert.equal(payload.text.format.strict,true);assert.equal(advice.question,'');assert.deepEqual(advice.choices,[]);assert.equal(advice.brief.lessonCount,3);assert.equal(advice.brief.tone,'Conversational');assert.deepEqual(advice.suggestedFields,['need','audience']);}finally{globalThis.fetch=fetch;}
});
