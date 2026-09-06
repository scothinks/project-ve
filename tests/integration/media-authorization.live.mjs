import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
const value = result => { assert.equal(result.error, null, result.error?.message); return result.data; };
test("saved media use and withdrawal serialize without granting later copies", async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const service = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const editor = createClient(url, key, { auth: { persistSession: false } });
  const manager = createClient(url, key, { auth: { persistSession: false } });
  const suffix = randomUUID(); const email = `media-race-${suffix}@example.test`; const password = randomUUID() + randomUUID();
  const user = value(await service.auth.admin.createUser({ email, password, email_confirm: true })).user;
  const courseId = `media-race-${suffix}`; const versions = [];
  try {
    value(await service.from("profiles").update({ role: "admin" }).eq("id", user.id));
    value(await editor.auth.signInWithPassword({ email, password })); value(await manager.auth.signInWithPassword({ email, password }));
    value(await service.from("courses").insert({ id: courseId, slug: courseId, title: "Media race", description: "Test", category: "Values", status: "published", catalog_scope: "platform" }));
    for (let round = 0; round < 3; round++) {
      const media = value(await service.rpc("service_register_media", { p_organization_id: null, p_storage_path: `registry/${randomUUID()}.png`, p_mime_type: "image/png", p_size: 100, p_title: "Race image", p_alt_text: "Test", p_rights_evidence: "Test-owned fixture." })); versions.push(media.id);
      const lessonId = `media-race-${suffix}-${round}`;
      value(await service.from("lessons").insert({ id: lessonId, course_id: courseId, slug: lessonId, title: "Race lesson", status: "draft" }));
      const pages = [{ id: "draft-page", title: "Page", page_type: "concept", page_number: 1, cover_image: { url: media.url } }];
      const save = () => editor.rpc("admin_save_lesson_builder", { p_lesson_id: lessonId, p_expected_revision: 0, p_pages: pages, p_blocks: [] });
      const withdraw = () => manager.rpc("admin_manage_media", { p_version_id: media.id, p_action: "withdraw" });
      const [saved, withdrawn] = await Promise.all([save(), withdraw()]); value(withdrawn);
      if (saved.error) assert.equal(saved.error.code, "42501", saved.error.message);
      else {
        value(await editor.rpc("admin_publish_lesson_checked", { p_lesson_id: lessonId, p_expected_revision: saved.data.draftRevision }));
        const existing = value(await editor.from("lessons").select("draft_revision,published_snapshot").eq("id", lessonId).single());
        const copied = await editor.rpc("admin_save_lesson_builder", { p_lesson_id: lessonId, p_expected_revision: existing.draft_revision,
          p_pages: [...existing.published_snapshot.pages, { ...pages[0], id: "draft-copy", page_number: 2 }], p_blocks: [] });
        assert.equal(copied.error?.code, "42501", "withdrawn media cannot gain another authorised placement");
      }
    }
  } finally {
    await service.from("courses").delete().eq("id", courseId);
    for (const id of versions) { value(await manager.rpc("admin_manage_media", { p_version_id: id, p_action: "delete" })); value(await service.rpc("service_finish_media_deletion", { p_version_id: id })); }
    await service.auth.admin.deleteUser(user.id);
  }
});

test("concurrent registry uploads enforce one shared organisation quota", async () => {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  assert.ok(['localhost','127.0.0.1'].includes(new URL(url).hostname),'quota fixtures are local only');
  const service=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
  const manager=createClient(url,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false}});
  const suffix=randomUUID(), org=randomUUID(), password=randomUUID()+randomUUID();
  const email=`media-quota-${suffix}@example.test`;
  const user=value(await service.auth.admin.createUser({email,password,email_confirm:true})).user;
  const versions=[];
  const register=size=>service.rpc('service_register_media',{p_organization_id:org,p_storage_path:`registry/${randomUUID()}.png`,p_mime_type:'image/png',p_size:size,p_title:'Quota fixture',p_alt_text:'Test',p_rights_evidence:'Fixture-owned media.'});
  try {
    value(await service.from('organizations').insert({id:org,slug:`media-quota-${suffix}`,name:'Media quota fixture',status:'published',created_by:user.id}));
    value(await service.from('organization_memberships').insert({organization_id:org,user_id:user.id,role:'organisation_owner',status:'active'}));
    value(await manager.auth.signInWithPassword({email,password}));
    versions.push(value(await register(104857400)).id);
    const results=await Promise.all([register(150),register(150)]);
    for(const result of results)if(!result.error)versions.push(result.data.id);
    assert.equal(results.filter(r=>!r.error).length,1);
    assert.equal(results.find(r=>r.error).error.code,'23514');
    assert.equal(value(await manager.rpc('organization_learning_storage_bytes',{p_organization_id:org})),104857550);
  } finally {
    for(const id of versions){value(await manager.rpc('admin_manage_media',{p_version_id:id,p_action:'delete',p_organization_id:org}));value(await service.rpc('service_finish_media_deletion',{p_version_id:id}));}
    if(versions.length)assert.equal(value(await manager.rpc('organization_learning_storage_bytes',{p_organization_id:org})),0,'unused deletion releases registered quota');
    value(await service.from('organizations').delete().eq('id',org));await service.auth.admin.deleteUser(user.id);
  }
});
