import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import test from 'node:test';
const hooks=registerHooks({resolve(specifier,context,next){
  if(specifier==='server-only')return {shortCircuit:true,url:'data:text/javascript,export {}'};
  if(specifier==='@/lib/app-errors')return {shortCircuit:true,url:'data:text/javascript,export const logAppError=()=>{};'};
  if(specifier.startsWith('@/')){
    const p=path.resolve(specifier.slice(2));const file=['','.ts','.tsx'].map(e=>p+e).find(existsSync);
    if(file)return {shortCircuit:true,url:pathToFileURL(file).href};
  }
  return next(specifier,context);
}});
const {processAuthoringPage}=await import('../../features/ai-generation/authoring/worker.ts');
const {generateAiLessonPageExtension}=await import('../../lib/ai-learning-generator.ts');
hooks.deregister();
const job={id:'job',lock_token:'token',lock_version:2};
const candidate={title:'A page',subtitle:'',pageType:'concept',blocks:[{blockType:'text',payload:{body:'<p>Safe</p><script>bad()</script>'}}]};
test('page worker checkpoints before provider work, sanitizes and retains without applying',async()=>{
 const calls=[];let saved;
 const client={rpc:async(name,args)=>{calls.push([name,args.p_action]); if(args.p_action==='ready')saved=args.p_candidate;return {data:{textOnly:true},error:null};}};
 const result=await processAuthoringPage(client,job,'worker',async context=>{assert.equal(context.textOnly,true);calls.push(['provider']);return structuredClone(candidate);});
 assert.equal(result.status,'completed');
 assert.deepEqual(calls,[['service_ai_page_checkpoint','begin'],['provider'],['service_ai_page_checkpoint','ready']]);
 assert.doesNotMatch(saved.blocks[0].payload.body,/<script>/);
});
test('uncertain earlier provider outcome never repeats the paid call',async()=>{
 let providerCalls=0;const phases=[];
 const client={rpc:async(_name,args)=>{phases.push(args.p_action);return {data:null,error:args.p_action==='begin'?{message:'Uncertain previous outcome'}:null};}};
 assert.equal((await processAuthoringPage(client,job,'worker',async()=>{providerCalls++;return candidate;})).status,'failed');
 assert.equal(providerCalls,0);assert.deepEqual(phases,['begin','failed']);
});
test('provider failure settles once without retry or automatic application',async()=>{
 const phases=[];let calls=0;
 const client={rpc:async(_name,args)=>{phases.push(args.p_action);return {data:{textOnly:true},error:null};}};
 await processAuthoringPage(client,job,'worker',async()=>{calls++;throw new Error('Provider timed out');});
 assert.equal(calls,1);assert.deepEqual(phases,['begin','failed']);
});
test('unsupported media output fails without creating assets or inserting a page',async()=>{
 const phases=[];
 const client={rpc:async(_name,args)=>{phases.push(args.p_action);return {data:{textOnly:true},error:null};}};
 await processAuthoringPage(client,job,'worker',async()=>({...candidate,blocks:[{blockType:'image',payload:{src:'invalid'}}]}));
 assert.deepEqual(phases,['begin','failed']);
});
test('purposeful placeholders are retained without generating or registering media',async()=>{
 let retained;const phases=[];
 const client={rpc:async(_name,args)=>{phases.push(args.p_action);if(args.p_action==='ready')retained=args.p_candidate;return {data:{mediaPlaceholders:true},error:null};}};
 const mediaIntent={version:1,kind:'image',purpose:'A diagram of three levels of government',aspectRatio:'16:9',required:false,style:'inherit'};
 const result=await processAuthoringPage(client,job,'worker',async()=>({...candidate,blocks:[...candidate.blocks,{blockType:'image',payload:{mediaIntent}}]}));
 assert.equal(result.status,'completed');assert.deepEqual(phases,['begin','ready']);
 assert.equal(retained.blocks[1].payload.src,'');assert.deepEqual(retained.blocks[1].payload.mediaIntent,mediaIntent);
});
test('assistant can retain a quiz recommendation without generating a page or media',async()=>{
 let retained;let calls=0;const phases=[];
 const context={assistant:true,pageCount:6,existingPages:[],contextTruncated:false};
 const client={rpc:async(_name,args)=>{phases.push(args.p_action);if(args.p_action==='ready')retained=args.p_candidate;return {data:context,error:null};}};
 const advice={title:'Review the quiz',subtitle:'',pageType:'concept',decision:'review_quiz',reason:'The lesson covers the idea and its application.',position:1,blocks:[]};
 const result=await processAuthoringPage(client,job,'worker',async()=>{calls++;return advice;});
 assert.equal(result.status,'completed');assert.equal(calls,1);assert.deepEqual(phases,['begin','ready']);assert.deepEqual(retained,advice);
});
test('assistant rejects an invalid placement before retaining the candidate',async()=>{
 const phases=[];const client={rpc:async(_name,args)=>{phases.push(args.p_action);return {data:{assistant:true,pageCount:1,existingPages:[]},error:null};}};
 const result=await processAuthoringPage(client,job,'worker',async()=>({...candidate,decision:'page',reason:'A useful example',position:99}));
 assert.equal(result.status,'failed');assert.deepEqual(phases,['begin','failed']);
});
test('provider request includes actual teaching context and parses the no-page recommendation',async()=>{
 const previousFetch=globalThis.fetch;const key=process.env.OPENAI_API_KEY;let requestBody;
 process.env.OPENAI_API_KEY=crypto.randomUUID();
 const advice={title:'Review the quiz',subtitle:'',pageType:'concept',decision:'review_quiz',reason:'Explanation and practice are covered.',position:1,blocks:[]};
 globalThis.fetch=async(_url,options)=>{requestBody=JSON.parse(options.body);return new Response(JSON.stringify({output_text:JSON.stringify(advice)}),{status:200});};
 try{
 const page=await generateAiLessonPageExtension({assistant:true,mediaPlaceholders:true,pageCount:1,contextTruncated:false,course:{title:'Values',category:'Civic',level:'beginner'},lesson:{title:'Listening',description:'How to listen'},existingPages:[{title:'Hear everyone',pageType:'concept',content:'Ask each neighbour what happened before choosing a solution.'}],focus:'',pageType:'concept'});
 assert.equal(page.decision,'review_quiz');assert.deepEqual(page.blocks,[]);
 assert.match(requestBody.input[1].content[0].text,/Ask each neighbour/);
 assert.ok(requestBody.text.format.schema.required.includes('decision'));
 assert.equal(requestBody.store,false);
 }finally{globalThis.fetch=previousFetch;if(key===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=key;}
});
