create or replace function public.increment_profile_xp(p_user_id uuid, p_amount integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_amount <= 0 then
    raise exception 'XP amount must be positive.';
  end if;

  update public.profiles
     set xp = xp + p_amount,
         xp_balance_cached = xp_balance_cached + p_amount
   where id = p_user_id;
end;
$$;

grant execute on function public.increment_profile_xp(uuid, integer) to authenticated;
