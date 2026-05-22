update public.rewards
set description = replace(description, 'Exchange XP', 'Redeem XP')
where description like '%Exchange XP%';

update public.rewards
set description = replace(description, 'after exchange', 'after redemption')
where description like '%after exchange%';

update public.rewards
set terms = replace(terms, 'after exchange', 'after redemption')
where terms like '%after exchange%';

update public.rewards
set claim_steps = (
  select jsonb_agg(
    replace(replace(step::text, 'Confirm the exchange.', 'Confirm the redemption.'), '"', '')::text
    order by ordinality
  )
  from jsonb_array_elements_text(public.rewards.claim_steps) with ordinality as steps(step, ordinality)
)
where claim_steps::text like '%exchange%';
