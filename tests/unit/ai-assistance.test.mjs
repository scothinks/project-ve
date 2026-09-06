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
const {validateAssistance}=await import('../../features/ai-generation/authoring/assistance-validation.ts');
const {generateAssistance,assistanceInstructions}=await import('../../features/ai-generation/authoring/assistance-provider.ts');
const {processAuthoringAssistance}=await import('../../features/ai-generation/authoring/assistance-worker.ts');
const {assistanceSchema}=await import('../../features/ai-generation/authoring/assistance-schema.ts');
hooks.deregister();
const context={kind:'quiz',count:1,focus:'',refinementInstruction:'',course:{title:'Community'},lessons:[{title:'Listening',pages:[{title:'Hear everyone',content:'Listen before choosing.'}]}],existingQuestions:[],suggestion:null,priorDraft:null};
const question={prompt:'What comes first?',questionType:'single_choice',explanation:'Listen before choosing.',xp:10,options:[{label:'Listen',isCorrect:true},{label:'Choose',isCorrect:false}]};
const quiz={title:'Listening',questions:[question]};
const draft={title:'Compare choices',description:'Consider everyone.',pages:[{title:'Compare',subtitle:'',pageType:'scenario',blocks:[{blockType:'text',payload:{body:'<p>Compare fairly.</p><script>bad()</script>'}},{blockType:'image',payload:{mediaIntent:{version:1,kind:'image',purpose:'Show two options',aspectRatio:'16:9',required:false,style:'inherit'}}}]}]};
test('quiz validates grounded, bounded questions and answer keys',()=>{
 assert.deepEqual(validateAssistance(quiz,context),quiz);
 assert.throws(()=>validateAssistance(quiz,{...context,lessons:[]}),/teaching content/);
 assert.throws(()=>validateAssistance(quiz,{...context,existingQuestions:[question.prompt]}),/repeated/);
 assert.throws(()=>validateAssistance(quiz,{...context,count:2}),/count/);
 for(const q of [{...question,xp:20},{...question,explanation:''},{...question,options:question.options.map(o=>({...o,isCorrect:true}))},{...question,options:question.options.map(o=>({...o,label:'Same'}))}])assert.throws(()=>validateAssistance({title:'Check',questions:[q]},context));
});
test('lesson drafts sanitize teaching and retain purposeful optional placeholders without assets',()=>{
 const result=validateAssistance(draft,{...context,kind:'lesson_draft'});
 assert.doesNotMatch(result.pages[0].blocks[0].payload.body,/<script>/);
 assert.equal(result.pages[0].blocks[1].payload.src,'');
 assert.equal(result.pages[0].blocks[1].payload.mediaIntent.purpose,'Show two options');
 const invalid=structuredClone(draft);invalid.pages[0].blocks[1].payload.src='https://example.test/image.png';
 assert.throws(()=>validateAssistance(invalid,{...context,kind:'lesson_draft'}),/placeholder/);
 invalid.pages[0].blocks=[draft.pages[0].blocks[1]];
 assert.throws(()=>validateAssistance(invalid,{...context,kind:'lesson_draft'}),/Teaching/);
});
test('plan scope and draft scope use separate schemas and cost instructions',()=>{
 assert.ok(assistanceSchema('lesson_plan').properties.suggestions);
 assert.ok(assistanceSchema('lesson_draft').properties.pages);
 assert.doesNotMatch(JSON.stringify(assistanceSchema('quiz')),/mediaIntent|pages/);
 assert.match(assistanceInstructions(context),/saved lesson teaching/);
 assert.match(assistanceInstructions({...context,kind:'lesson_draft'}),/Do not include quiz/);
});
test('worker checkpoints before provider and never auto inserts or retries an uncertain call',async()=>{
 let calls=[];const job={id:'job',lock_token:crypto.randomUUID(),lock_version:1};
 const client={rpc:async(name,args)=>{calls.push([name,args.p_action]);return {data:context,error:null};}};
 const result=await processAuthoringAssistance(client,job,'fixture',async()=>{calls.push(['provider']);return quiz;});
 assert.equal(result.status,'completed');assert.deepEqual(calls,[['service_ai_page_checkpoint','begin'],['provider'],['service_ai_page_checkpoint','ready']]);
 calls=[];let paid=0;
 const failed={rpc:async(name,args)=>{calls.push(args.p_action);return {data:null,error:args.p_action==='begin'?new Error('Uncertain earlier provider outcome'):null};}};
 assert.equal((await processAuthoringAssistance(failed,job,'fixture',async()=>{paid++;return quiz;})).status,'failed');assert.equal(paid,0);assert.deepEqual(calls,['begin','failed']);
});
test('provider uses configured model, strict Responses JSON and one bounded nonstored request',async()=>{
 const original=globalThis.fetch;const oldKey=process.env.OPENAI_API_KEY;const oldModel=process.env.OPENAI_TEXT_MODEL;
 process.env.OPENAI_API_KEY=crypto.randomUUID();process.env.OPENAI_TEXT_MODEL='configured-model';let calls=0;
 globalThis.fetch=async(url,init)=>{calls++;assert.equal(url,'https://api.openai.com/v1/responses');const body=JSON.parse(init.body);assert.equal(body.model,'configured-model');assert.equal(body.store,false);assert.equal(body.text.format.strict,true);assert.ok(init.signal instanceof AbortSignal);return Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(quiz)}]}]});};
 try{assert.deepEqual(await generateAssistance(context),quiz);assert.equal(calls,1);
 globalThis.fetch=async()=>Response.json({status:'incomplete',output:[]});await assert.rejects(generateAssistance(context),/incomplete/);
 globalThis.fetch=async()=>Response.json({status:'completed',output:[{content:[{type:'refusal'}]}]});await assert.rejects(generateAssistance(context),/could not/);
 }finally{globalThis.fetch=original;if(oldKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=oldKey;if(oldModel===undefined)delete process.env.OPENAI_TEXT_MODEL;else process.env.OPENAI_TEXT_MODEL=oldModel;}
});
