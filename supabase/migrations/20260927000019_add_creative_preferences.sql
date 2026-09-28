-- Customer creative preferences, passed to the AI director as guidance.
-- Neutral defaults, so existing projects keep their previous behaviour.
alter table public.projects
  add column creative_direction text not null default 'Auto'
    check (creative_direction in ('Auto', 'Story Ad', 'Product Demo', 'Fast Promo', 'Cinematic Brand', 'Explainer')),
  add column motion_level text not null default 'Balanced'
    check (motion_level in ('Subtle', 'Balanced', 'Dynamic', 'High Energy')),
  add column visual_density text not null default 'Balanced'
    check (visual_density in ('Clean', 'Balanced', 'Rich')),
  add column advanced_direction text not null default ''
    check (char_length(advanced_direction) <= 300);

grant update (creative_direction, motion_level, visual_density, advanced_direction) on public.projects to authenticated;
