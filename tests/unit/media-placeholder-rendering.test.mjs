import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const stub=source=>({shortCircuit:true,url:'data:text/javascript,'+encodeURIComponent(source)});
const hooks=registerHooks({
 resolve(specifier,context,next){
  if(specifier==='@/components/media/MediaPlayback')return stub('export const MediaAudio=()=>null; export const MediaVideo=()=>null;');
  if(specifier==='@/components/media/MediaImage')return stub('export default ()=>null;');
  if(specifier.startsWith('@/'))return {shortCircuit:true,url:pathToFileURL(path.resolve(specifier.slice(2)+'.ts')).href};
  return next(specifier,context);
 },
 load(url,context,next){
  if(url.endsWith('/components/lesson/LessonContent.tsx'))return {shortCircuit:true,format:'module',source:ts.transpileModule(readFileSync(fileURLToPath(url),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext}}).outputText};
  return next(url,context);
 },
});
const {LessonContent}=await import('../../components/lesson/LessonContent.tsx');
hooks.deregister();
test('placeholder descriptions are editorial-only and never reach learner rendering',()=>{
 const blocks=[{id:'media',type:'media_placeholder',kind:'image',purpose:'A suggested diagram',required:false}];
 assert.match(renderToStaticMarkup(React.createElement(LessonContent,{blocks,isPreview:true})),/A suggested diagram/);
 const learner=renderToStaticMarkup(React.createElement(LessonContent,{blocks}));
 assert.doesNotMatch(learner,/suggested diagram|placeholder|<img|<video|<audio/);
});
test('callout teaching renders safe rich text and preserves legacy plain text in preview and delivery',()=>{
 const rich={id:'reflection',type:'callout',variant:'key_point',title:'Explain the tradeoff',body:'<p>Compare <strong>the same needs</strong>.</p><script>bad()</script><a href="javascript:bad()">Unsafe link</a>'};
 const plain={id:'plain',type:'callout',variant:'tip',title:'Check',body:'A & B both matter.'};
 for(const isPreview of [true,false]){
  const markup=renderToStaticMarkup(React.createElement(LessonContent,{blocks:[rich,plain],variant:'reflection',isPreview}));
  assert.match(markup,/<p>Compare <strong>the same needs<\/strong>\.<\/p>/);
  assert.match(markup,/A &amp; B both matter\./);
  assert.doesNotMatch(markup,/&lt;p&gt;|<script|javascript:/);
 }
});
