-- Internal cost ledger. Written only by the service role; owners may read
-- their own project's events. Estimated provider cost, not customer billing.
create table public.cost_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  operation text not null
    check (operation in ('openai_brief', 'fal_voice', 'fal_image', 'remotion_render', 'storage')),
  model text,
  duration_seconds numeric(10, 3),
  resolution text check (resolution in ('1080p', '4k')),
  quantity numeric(20, 3),
  estimated_cost_usd numeric(12, 6) not null default 0 check (estimated_cost_usd >= 0),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index cost_events_project_id_idx on public.cost_events (project_id);
create index cost_events_user_id_idx on public.cost_events (user_id);

alter table public.cost_events enable row level security;

create policy "Users can read own cost events"
  on public.cost_events for select to authenticated
  using ((select auth.uid()) = user_id);

revoke insert, update, delete, truncate on public.cost_events from anon, authenticated;
