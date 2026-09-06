import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
const state={enabled:true,notice:null};globalThis.__coursePageTest=state;
const stub=source=>({shortCircuit:true,url:'data:text/javascript,'+encodeURIComponent(source)});
const hook=registerHooks({resolve(specifier,context,next){
 if(specifier==='react/jsx-runtime')return stub('export const jsx=(type,props)=>({type,props});');
 if(specifier==='@/lib/admin')return stub('export const requireAdmin=async()=>({});');
 if(specifier==='@/features/organizations/admin/entitlement-guards')return stub('export const getAdminWorkspaceAiAuthoringNotice=async()=>globalThis.__coursePageTest.notice;');
 if(specifier==='@/features/ai-generation/authoring/availability')return stub('export const pageAuthoringEnabled=()=>globalThis.__coursePageTest.enabled;');
 if(specifier==='@/components/admin/ai/AiCourseAuthoring')return stub('export const AiCourseAuthoring=()=>null;');
 return next(specifier,context);
}});
const source=readFileSync(new URL('../../app/admin/courses/ai/brief/page.tsx',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {default:page}=await import('data:text/javascript,'+encodeURIComponent(code));hook.deregister();
test('retained course result remains reachable when AI entitlement or rollout is disabled',async()=>{
 for(const enabled of [true,false])for(const notice of [null,'Plan unavailable']){
  Object.assign(state,{enabled,notice});const rendered=await page({searchParams:Promise.resolve({aiResult:'retained-result'})});
  assert.equal(rendered.props.initialId,'retained-result');assert.equal(rendered.props.enabled,enabled&&!notice);
 }
});
