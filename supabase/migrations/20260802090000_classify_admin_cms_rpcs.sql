revoke execute on function public.admin_reorder_course_lessons(text, text[]) from public, anon, authenticated, service_role;
grant execute on function public.admin_reorder_course_lessons(text, text[]) to authenticated, service_role;

revoke execute on function public.admin_reorder_quiz_questions(text, text[]) from public, anon, authenticated, service_role;
grant execute on function public.admin_reorder_quiz_questions(text, text[]) to authenticated, service_role;

revoke execute on function public.admin_delete_quiz_question(text, text) from public, anon, authenticated, service_role;
grant execute on function public.admin_delete_quiz_question(text, text) to authenticated, service_role;

insert into private.rpc_security_classifications (
  function_schema,
  function_name,
  identity_arguments,
  classification,
  intended_callers,
  authorization_rule,
  execute_roles
)
values
  (
    'public',
    'admin_reorder_course_lessons',
    'p_course_id text, p_lesson_ids text[]',
    'ADMIN_AUTHENTICATED',
    'Authenticated admin CMS curriculum ordering workflow.',
    'Requires auth.uid() and public.current_user_is_admin() before validating complete course lesson membership, updating sort_order, and writing audit events.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'admin_reorder_quiz_questions',
    'p_quiz_id text, p_question_ids text[]',
    'ADMIN_AUTHENTICATED',
    'Authenticated admin CMS quiz question ordering workflow.',
    'Requires auth.uid() and public.current_user_is_admin() before validating complete quiz question membership, updating question_order, bumping quiz version, and writing audit events.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'admin_delete_quiz_question',
    'p_quiz_id text, p_question_id text',
    'ADMIN_AUTHENTICATED',
    'Authenticated admin CMS quiz question deletion workflow.',
    'Requires auth.uid() and public.current_user_is_admin() before verifying quiz membership, refusing questions with learner attempt history, deleting the question, reordering remaining questions, bumping quiz version, and writing audit events.',
    array['authenticated', 'service_role']
  )
on conflict (function_schema, function_name, identity_arguments) do update
set classification = excluded.classification,
    intended_callers = excluded.intended_callers,
    authorization_rule = excluded.authorization_rule,
    execute_roles = excluded.execute_roles,
    reviewed_at = now();
