import { test, expect } from '@playwright/test';
import { checked, mediaFixture } from '../support/media-browser';
import { listeningLesson, comparisonLesson } from '../support/course-teaching-fixtures';
test.use({ actionTimeout: 60_000 });
test.describe.configure({ timeout: 300_000 });
const outline={title:'Decide together',description:'Listen and choose fairly.',lessons:[{title:'Listen first',description:'Hear everyone.'},{title:'Choose fairly',description:'Compare effects.'}]};
const question={prompt:'What comes first?',questionType:'single_choice',explanation:'Hear everyone before choosing.',xp:10,options:[{label:'Hear everyone',isCorrect:true},{label:'Choose immediately',isCorrect:false}]};
const lesson=(title:string,questions:number,index:number)=>({...structuredClone(index===0?listeningLesson:comparisonLesson),title,questions:questions?[index===0?question:{...question,prompt:'What makes a comparison fair?',explanation:'Apply the same needs to each option so its tradeoffs are visible.',options:[{label:'Compare each option against the same needs',isCorrect:true},{label:'Count only the most popular preference',isCorrect:false}]}]:[]});
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j7l8AAAAASUVORK5CYII=','base64');
for(const partial of [false,true])test(partial?'partial course recovery keeps completed lessons and retries only unfinished work':'editable outline, separate quote, explicit course save, review and publish',async({browser,baseURL},info)=>{
  const f=await mediaFixture(browser,baseURL!);const page=await f.context.newPage();const resultIds:string[]=[];const calls:number[]=[];let savedCourse:string|undefined;let failNextDraft=partial;let dropApply=false;
  try{
    // Exercise real fallback reads so a buffered SSE response cannot make the
    // concurrent-edit assertion depend on transport timing.
    if(!partial)await page.route('**/api/admin/ai/authoring/events?**',route=>route.abort());
    await page.route('**/api/admin/ai/authoring',async route=>{
      const body=route.request().method()==='POST'?route.request().postDataJSON():{};
      if(body.action==='apply'&&dropApply){dropApply=false;const replies=await Promise.all([route.fetch(),route.fetch()]);for(const r of replies)expect(r.ok(),await r.text()).toBeTruthy();return route.abort();}
      if(body.action!=='start')return route.continue();
      const result=checked(await f.editor.rpc('admin_start_ai_page',{p_id:body.id}));resultIds.push(body.id);
      const j=checked(await f.service.rpc('service_claim_ai_page',{p_id:body.id,p_worker:'course-browser'}))[0];
      const step=async(action:string,candidate?:object)=>checked(await f.service.rpc('service_ai_course_checkpoint',{p_job:j.id,p_worker:'course-browser',p_token:j.lock_token,p_version:j.lock_version,p_action:action,p_candidate:candidate}));
      if(result.kind==='course_outline'){await step('begin');await step('checkpoint',outline);}
      else for(let i=0;i<6;i++){
        const ctx=await step('begin');if(ctx.done)break;calls.push(ctx.index);
        if(failNextDraft&&i===1){failNextDraft=false;await step('failed');break;}
        const state=await step('checkpoint',lesson(ctx.outline.lessons[ctx.index].title,ctx.questionsPerLesson,ctx.index));if(state.done)break;
      }
      await route.fulfill({json:result});
    });
    await page.goto(`${baseURL}/admin/courses/ai/brief`);
    await page.getByRole('button',{name:'I have a brief'}).click();await page.getByLabel('Learning goal').fill('Make fair choices in a community.');await page.getByLabel('Who this will help').fill('Young adults');await page.getByText('Course options ·', {exact:false}).click();await page.getByLabel('Number of lessons').fill('2');
    expect(resultIds).toHaveLength(0);await page.getByRole('button',{name:'Generate · 0 credits',exact:true}).click();
    await expect(page.getByLabel('Course title', {exact:true})).toHaveValue('Decide together');
    const actions=page.getByRole('group',{name:'Outline actions',exact:true});
    await expect(actions.getByRole('button',{name:'Generate course - 0 credits',exact:true})).toBeEnabled();
    if(!partial){
      for(const width of [1280,390,320]){
        await page.setViewportSize({width,height:900});
        const boxes=await actions.getByRole('button').evaluateAll(buttons=>buttons.map(button=>{const r=button.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,overflow:button.scrollWidth>button.clientWidth};}));
        expect(boxes).toHaveLength(3);
        expect(boxes.some(b=>b.overflow)).toBe(false);
        if(width>=640){
          expect(Math.max(...boxes.map(b=>b.top))-Math.min(...boxes.map(b=>b.top))).toBeLessThan(2);
          expect(boxes[0].right).toBeLessThanOrEqual(boxes[1].left);expect(boxes[1].right).toBeLessThanOrEqual(boxes[2].left);
        }else{
          const bounds=await actions.boundingBox();
          for(const box of boxes){expect(Math.abs(box.left-bounds!.x)).toBeLessThan(2);expect(Math.abs(box.right-bounds!.x-bounds!.width)).toBeLessThan(2);}
          expect(boxes[0].bottom).toBeLessThan(boxes[1].top);expect(boxes[1].bottom).toBeLessThan(boxes[2].top);
        }
        const savedActions=page.getByRole('group',{name:'Saved work actions',exact:true});
        const recovery=await savedActions.getByRole('link',{name:'Resume earlier work'}).boundingBox();const deletion=await savedActions.getByRole('button',{name:'Delete',exact:true}).boundingBox();
        expect(Math.abs(recovery!.y+recovery!.height/2-deletion!.y-deletion!.height/2)).toBeLessThan(2);
        expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
        await actions.scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath(`outline-actions-${width}.png`)});
      }
      await page.setViewportSize({width:1280,height:900});
      await actions.getByRole('button',{name:'Refine - 0 credits',exact:true}).click();
      const refinement=page.getByRole('dialog',{name:'Refine your outline'});
      await expect(refinement.getByLabel('Refinement direction')).toBeFocused();
      await expect(refinement.getByRole('button',{name:'Refine - 0 credits',exact:true})).toBeDisabled();
      await refinement.getByLabel('Refinement direction').fill('Emphasise listening in team meetings.');
      await expect(refinement.getByRole('button',{name:'Refine - 0 credits',exact:true})).toBeEnabled();
      await page.keyboard.press('Escape');await expect(refinement).toHaveCount(0);
      await expect(actions.getByRole('button',{name:'Refine - 0 credits',exact:true})).toBeFocused();expect(resultIds).toHaveLength(1);
      await page.getByRole('button',{name:'Delete',exact:true}).click();await expect(page.getByRole('alertdialog')).toBeVisible();
      await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(actions).toBeVisible();
    }
    await page.getByLabel('Course title',{exact:true}).fill('Community choices');
    await page.getByRole('button',{name:'Add lesson',exact:true}).click();
    await page.getByLabel('Lesson title',{exact:true}).nth(2).fill('Reflect together');await page.getByLabel('What it teaches').nth(2).fill('Review the decision.');
    await page.getByRole('button',{name:'Move up',exact:true}).nth(2).click();await expect(page.getByLabel('Lesson title',{exact:true}).nth(1)).toHaveValue('Reflect together');
    await page.getByRole('button',{name:'Remove',exact:true}).nth(1).click();
    if(!partial){
      checked(await f.editor.rpc('admin_save_ai_course_outline',{p_id:resultIds[0],p_revision:1,p_outline:{...outline,title:'Another editor course'}}));
      await expect(page.locator('[data-outline-revision="2"]')).toBeVisible({timeout:30_000});
      await page.getByRole('button',{name:'Generate course - 0 credits',exact:true}).click();
      await expect(page.getByRole('alert').filter({hasText:'The outline changed'})).toBeVisible();
      await expect(page.getByLabel('Course title',{exact:true})).toHaveValue('Community choices');
      expect(checked(await f.editor.rpc('admin_read_ai_results',{p_id:resultIds[0]})).outline.title).toBe('Another editor course');
      await page.getByRole('button',{name:'Reload saved outline'}).click();await page.getByRole('button',{name:'Reload outline',exact:true}).click();
      await expect(page.getByLabel('Course title',{exact:true})).toHaveValue('Another editor course');await page.getByLabel('Course title',{exact:true}).fill('Community choices');
    }
    await page.getByRole('combobox',{name:'Quiz scope'}).click();await page.getByRole('option',{name:partial?'No quizzes':'1 question per lesson',exact:true}).click();
    await actions.getByRole('button',{name:'Save',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Outline saved'})).toBeVisible();
    expect(resultIds).toHaveLength(1);
    await page.getByRole('button',{name:'Generate course - 0 credits',exact:true}).click();
    await expect.poll(()=>resultIds.length).toBe(2);
    if(partial){
      await expect(page.getByRole('button',{name:'Retry · 0 credits'})).toBeVisible();
      await expect(page.getByRole('button',{name:'Save only 1 completed lesson',exact:true})).toBeVisible();
      const failedId=resultIds[1];
      await page.goto(`${baseURL}/admin/courses/ai-results`);await page.locator(`button[data-result-id="${failedId}"]`).click();await page.getByRole('link',{name:'Open course result'}).click();
      await expect(page.locator('summary').filter({hasText:'Lesson 1: Listen first'})).toBeVisible();
      await page.getByRole('button',{name:'Retry · 0 credits'}).click();await expect(page.getByRole('button',{name:'Save course draft',exact:true})).toBeVisible();
      expect(calls).toEqual([0,1,1]);expect(checked(await f.editor.rpc('admin_read_ai_results',{p_id:failedId})).completedCount).toBe(1);
    }else await expect(page.getByRole('button',{name:'Save course draft',exact:true})).toBeVisible();
    await page.locator('summary').filter({hasText:'Lesson 2: Choose fairly'}).click();
    await expect(page.getByText('A quiet neighbour',{exact:true})).toBeVisible();
    await expect(page.getByText('Defend and revisit the choice',{exact:true})).toBeVisible();
    await expect(page.getByRole('cell',{name:'Family carers need cover',exact:true})).toBeVisible();
    await expect(page.getByText('Try: You need a time that fits your shift. Have I understood correctly?',{exact:true})).toBeVisible();
    const finalId=resultIds.at(-1)!;
    expect(checked(await f.editor.from('courses').select('id').eq('id',`course-ai-${finalId.replaceAll('-','')}`))).toHaveLength(0);
    await page.setViewportSize({width:390,height:844});await expect(page.getByRole('button',{name:'Save course draft',exact:true})).toBeVisible();
    await page.screenshot({path:info.outputPath(`${partial?'recovered-mobile':'course-mobile'}.png`),fullPage:true});
    await page.setViewportSize({width:1280,height:900});
    if(partial)dropApply=true;
    await page.getByRole('button',{name:'Save course draft',exact:true}).click();
    if(partial){await page.reload();}
    await expect(page.getByRole('link',{name:'Open saved course'})).toBeVisible({timeout:30_000});
    const result=checked(await f.editor.rpc('admin_read_ai_results',{p_id:finalId}));savedCourse=result.receipt.courseId;
    expect(checked(await f.editor.from('lessons').select('id').eq('course_id',savedCourse!))).toHaveLength(2);
    expect(checked(await f.editor.from('learning_media_assets').select('id').eq('course_id',savedCourse!))).toHaveLength(0);
    expect(checked(await f.editor.from('courses').select('status,ai_text_status').eq('id',savedCourse!).single())).toMatchObject({status:'draft',ai_text_status:'draft'});
    if(!partial){
      await page.goto(`${baseURL}/admin/courses/${savedCourse}/review`);await expect(page.getByRole('button',{name:'Approve reviewed course'})).toBeDisabled();
      const art=(await f.upload(png)).asset!;
      checked(await f.editor.rpc('admin_set_ai_course_artwork',{p_course:savedCourse,p_version:art.id,p_target:'course_thumbnail'}));
      checked(await f.editor.rpc('admin_set_ai_course_artwork',{p_course:savedCourse,p_version:art.id,p_target:'course_cover'}));
      await page.reload();await expect(page.getByRole('button',{name:'Approve reviewed course'})).toBeEnabled();
      await page.getByRole('checkbox',{name:'I have reviewed the course, lesson content, quiz answers and any attached media.'}).check();
      await page.getByRole('button',{name:'Approve reviewed course'}).click();await expect(page.getByRole('button',{name:'Publish course',exact:true})).toBeVisible();
      await page.screenshot({path:info.outputPath('review-desktop.png'),fullPage:true});
      await page.getByRole('button',{name:'Publish course',exact:true}).click();await expect.poll(async()=>checked(await f.editor.from('courses').select('status').eq('id',savedCourse!).single()).status).toBe('published');
      const lessons=checked(await f.editor.from('lessons').select('id,published_snapshot').eq('course_id',savedCourse!).order('sort_order'));expect(lessons.every(l=>l.published_snapshot)).toBeTruthy();
      await page.goto(`${baseURL}/lessons/${lessons[0].id}`);await expect(page.getByText(/A request for evening meetings may hide a need/)).toBeVisible();
      await page.goto(`${baseURL}/lessons/${lessons[0].id}?page=2`);await expect(page.getByText(/At a meeting, Ada stays silent/)).toBeVisible();await expect(page.getByText(/Image Placeholder/i)).toHaveCount(0);
      await page.goto(`${baseURL}/lessons/${lessons[1].id}`);await expect(page.getByRole('cell',{name:'Family carers need cover',exact:true})).toBeVisible();
      await page.goto(`${baseURL}/lessons/${lessons[1].id}?page=2`);await expect(page.getByText('Choose a meeting time from the comparison. Name the need it serves, the barrier it leaves, and one adjustment that reduces that barrier. What evidence after the first meeting would make you reconsider?',{exact:true})).toBeVisible();
    }else{
      const first=checked(await f.editor.from('lessons').select('id').eq('course_id',savedCourse!).order('sort_order').limit(1))[0];
      await page.goto(`${baseURL}/admin/courses/lessons/${first.id}/preview?section=review`);
      await page.getByRole('checkbox',{name:'I have reviewed the lesson text, quiz and any media. Optional placeholders can remain empty.'}).check();
      await page.getByRole('button',{name:'Mark lesson reviewed'}).click();
      await expect.poll(async()=>checked(await f.editor.from('lessons').select('ai_text_status').eq('id',first.id).single()).ai_text_status).toBe('approved');
    }
  }finally{
    if(savedCourse)checked(await f.service.from('courses').delete().eq('id',savedCourse));
    await f.cleanup();
  }
});
