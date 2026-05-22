alter table public.reward_redemptions
  drop constraint if exists reward_redemptions_xp_cost_at_redemption_check;

alter table public.reward_redemptions
  add constraint reward_redemptions_xp_cost_at_redemption_check
    check (xp_cost_at_redemption is null or xp_cost_at_redemption >= 0);
