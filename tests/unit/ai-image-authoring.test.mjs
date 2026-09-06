import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { IMAGE_STYLES, resolveImageStyle, imagePrompt, imageStyleDraft } from '../../features/ai-generation/authoring/image-style.ts';
const hooks=registerHooks({resolve(specifier,context,next){
 if(specifier==='server-only')return {shortCircuit:true,url:'data:text/javascript,export {}'};
 if(specifier==='@/lib/app-errors')return {shortCircuit:true,url:'data:text/javascript,export const logAppError=()=>{};'};
 if(specifier.startsWith('@/')) {const p=path.resolve(specifier.slice(2));const file=['','.ts','.tsx'].map(e=>p+e).find(existsSync);if(file)return {shortCircuit:true,url:pathToFileURL(file).href};}
 return next(specifier,context);
}});
const {processAuthoringImage}=await import('../../features/ai-generation/authoring/image-worker.ts');hooks.deregister();
const style={preset:'photography',palette:'Blue',direction:''};
test('style requires an explicit choice; snapshots do not share mutable defaults',()=>{
 assert.throws(()=>resolveImageStyle('inherit',null));
 const resolved=resolveImageStyle('inherit',style);assert.deepEqual(resolved,style);assert.notEqual(resolved,style);
 assert.throws(()=>resolveImageStyle({preset:'custom',palette:'',direction:''},null));
 const prompts=IMAGE_STYLES.map(s=>imagePrompt({brief:'Three branches of government',style:{preset:s.id,palette:'',direction:s.id==='custom'?'Ink on white paper':''},aspectRatio:'16:9'}));
 assert.equal(new Set(prompts).size,5);for(const p of prompts)assert.doesNotMatch(p,/warm|brown|cartoon/);
});
const context={id:crypto.randomUUID(),brief:'Three levels of government',style,aspectRatio:'16:9'};
const png=Buffer.from('89504e470d0a1a0a','hex');
function client(log,{beginError=false,uploadError=false,readyError=false}={}) {return {
 rpc:async(name,a)=>{log.push(a.p_action);return {data:context,error:(a.p_action==='begin'&&beginError)||(a.p_action==='ready'&&readyError)?new Error('Failure'):null};},
 storage:{from:bucket=>{assert.equal(bucket,'learning-media-private');return {upload:async(p,b,opts)=>{log.push('upload');assert.match(p,/registry\/authoring-/);assert.equal(opts.upsert,false);return {error:uploadError?new Error('Storage full'):null};}};}}
};}
test('ready comes after one provider call and durable upload, never application',async()=>{
 const log=[];const result=await processAuthoringImage(client(log),{id:crypto.randomUUID(),lock_token:crypto.randomUUID(),lock_version:1},'test',async(prompt,model,size)=>{log.push('provider');assert.match(prompt,/Photographic/);assert.equal(size,'1536x1024');return {bytes:png};});
 assert.equal(result.status,'completed');assert.deepEqual(log,['begin','provider','upload','ready']);
});
test('uncertain started work cannot make another provider request',async()=>{
 const log=[];await processAuthoringImage(client(log,{beginError:true}),{},'test',async()=>{throw new Error('Must not call');});assert.deepEqual(log,['begin','failed']);
});
test('storage failure never presents a ready paid image or retries the provider',async()=>{
 const log=[];let calls=0;await processAuthoringImage(client(log,{uploadError:true}),{},'test',async()=>{calls++;return {bytes:png};});assert.equal(calls,1);assert.deepEqual(log,['begin','upload','failed']);
});
test('uncertain registry response preserves stored file and does not repeat generation',async()=>{
 const log=[];await processAuthoringImage(client(log,{readyError:true}),{},'test',async()=>({bytes:png}));assert.deepEqual(log,['begin','upload','ready']);
});
test('invalid provider bytes cannot be stored or registered',async()=>{
 const log=[];await processAuthoringImage(client(log),{},'test',async()=>({bytes:Buffer.from('not an image')}));assert.deepEqual(log,['begin','failed']);
});

test('block style autosave preserves incomplete custom direction without accepting it for generation',()=>{
 const draft={preset:'custom',palette:'Indigo',direction:''};
 assert.deepEqual(imageStyleDraft(draft),draft);
 assert.throws(()=>resolveImageStyle(imageStyleDraft(draft),null));
 assert.equal(imageStyleDraft('inherit'),'inherit');
 assert.equal(imageStyleDraft({preset:'unknown',palette:'',direction:''}),undefined);
 assert.equal(imageStyleDraft({preset:'flat',palette:'x'.repeat(201),direction:'y'.repeat(1001)}).palette.length,200);
});
