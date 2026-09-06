import test from 'node:test';
import assert from 'node:assert/strict';
import { isEmptyMediaPlaceholder, normalizeMediaPlaceholder } from '../../lib/media-intent.ts';
import { mapPreviewBlock } from '../../features/learning/admin/lesson-page-builder-domain.ts';
const intent={version:1,kind:'image',purpose:'A diagram showing the relationship',aspectRatio:'16:9',required:false,style:'inherit'};
test('empty media has an honest editor preview rather than a stock image',()=>{
 const block={id:'image',block_type:'image',payload:normalizeMediaPlaceholder('image',{mediaIntent:intent})};
 assert.equal(isEmptyMediaPlaceholder(block),true);
 assert.equal(mapPreviewBlock(block).type,'media_placeholder');
 assert.equal(mapPreviewBlock(block).purpose,intent.purpose);
 assert.equal(isEmptyMediaPlaceholder({...block,payload:{...block.payload,src:'/api/media/chosen'}}),false);
 assert.equal(mapPreviewBlock({...block,payload:{...block.payload,src:'/api/media/chosen'}}).type,'image');
});
test('generated placeholders cannot contain files, required media or mismatched kinds',()=>{
 for(const payload of [{mediaIntent:intent,src:'https://example.test/image.png'},{mediaIntent:{...intent,required:true}},{mediaIntent:{...intent,kind:'video'}},{mediaIntent:{...intent,purpose:''}},{mediaIntent:intent,assetId:'asset'}]) {
  assert.throws(()=>normalizeMediaPlaceholder('image',payload));
 }
});
