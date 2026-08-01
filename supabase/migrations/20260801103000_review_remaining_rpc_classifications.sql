revoke execute on function public.find_existing_reward_inventory_values(text, text, jsonb) from public, anon;
grant execute on function public.find_existing_reward_inventory_values(text, text, jsonb) to authenticated, service_role;

revoke execute on function public.refund_reward_redemption(uuid, text) from public, anon;
grant execute on function public.refund_reward_redemption(uuid, text) to authenticated, service_role;

revoke execute on function public.mission_proof_fields_satisfy(
  text[],
  text,
  uuid,
  text,
  text,
  text[]
) from public, anon, authenticated, service_role;

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
    'find_existing_reward_inventory_values',
    'p_reward_id text, p_item_type text, p_values jsonb',
    'ADMIN_AUTHENTICATED',
    'Authenticated admin inventory import workflows.',
    'Requires auth.uid() and public.current_user_is_admin() before reading existing inventory values.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'refund_reward_redemption',
    'p_redemption_id uuid, p_reason text',
    'ADMIN_AUTHENTICATED',
    'Authenticated admin redemption refund workflows.',
    'Requires auth.uid() and an admin profile before refunding XP, restoring inventory, updating redemption state, or writing audit events.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'mission_proof_fields_satisfy',
    'p_required_fields text[], p_requirement_mode text, p_user_id uuid, p_mission_id text, p_award_scope text, p_allowed_statuses text[]',
    'INTERNAL_HELPER',
    'Trusted mission completion and admin proof-review workflows only.',
    'No API role may execute directly because the helper accepts caller-supplied user and status inputs. Supported callers are SECURITY DEFINER mission RPCs that derive or verify the actor first.',
    array[]::text[]
  )
on conflict (function_schema, function_name, identity_arguments) do update
set classification = excluded.classification,
    intended_callers = excluded.intended_callers,
    authorization_rule = excluded.authorization_rule,
    execute_roles = excluded.execute_roles,
    reviewed_at = now();
