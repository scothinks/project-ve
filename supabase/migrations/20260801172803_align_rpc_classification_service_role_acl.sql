do $$
declare
  v_updated integer;
begin
  update private.rpc_security_classifications
  set execute_roles = array['authenticated', 'service_role'],
      intended_callers = 'Authenticated learners and trusted service-role maintenance calls scoped to the current auth context.',
      authorization_rule = 'Uses auth.uid() as the only user identity source and only records a completion for the current user when the target page belongs to a published lesson/course.',
      reviewed_at = now()
  where function_schema = 'public'
    and function_name = 'complete_lesson_page'
    and identity_arguments = 'p_lesson_id text, p_page_id text';

  get diagnostics v_updated = row_count;

  if v_updated <> 1 then
    raise exception 'Expected one complete_lesson_page RPC classification row, updated %.', v_updated;
  end if;

  update private.rpc_security_classifications
  set execute_roles = array['authenticated', 'service_role'],
      intended_callers = 'Authenticated learners and trusted service-role maintenance calls scoped to the current auth context.',
      authorization_rule = 'Uses auth.uid() as the only user identity source and only updates read_at for a notification owned by the current user.',
      reviewed_at = now()
  where function_schema = 'public'
    and function_name = 'mark_notification_read'
    and identity_arguments = 'p_notification_id uuid';

  get diagnostics v_updated = row_count;

  if v_updated <> 1 then
    raise exception 'Expected one mark_notification_read RPC classification row, updated %.', v_updated;
  end if;

  update private.rpc_security_classifications
  set execute_roles = array['authenticated', 'service_role'],
      intended_callers = 'Authenticated learners and trusted service-role maintenance calls scoped to the current auth context.',
      authorization_rule = 'Uses auth.uid() as the only user identity source and only updates read_at on unread notifications owned by the current user.',
      reviewed_at = now()
  where function_schema = 'public'
    and function_name = 'mark_all_notifications_read'
    and identity_arguments = '';

  get diagnostics v_updated = row_count;

  if v_updated <> 1 then
    raise exception 'Expected one mark_all_notifications_read RPC classification row, updated %.', v_updated;
  end if;
end;
$$;
