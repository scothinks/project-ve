begin;
do $$ begin execute replace(pg_get_functiondef('public.admin_start_ai_page(uuid)'::regprocedure),'''course_media''','''media_assets'''); end $$;
commit;
