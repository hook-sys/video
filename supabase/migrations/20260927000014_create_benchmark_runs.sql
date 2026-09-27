-- Development benchmark results for real end-to-end generations.
-- Costs are estimates from usage × configured rates (lib/costs/pricing.ts).
-- Written only by the service role; owners may read their own runs.
create table public.benchmark_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  source_project_id uuid not null references public.projects (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  duration_seconds int not null,
  resolution text not null check (resolution in ('1080p', '4k')),
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  error text,
  openai_model text,
  openai_input_tokens int,
  openai_output_tokens int,
  voice_model text,
  voice_characters int,
  image_model text,
  image_count int,
  render_ms int,
  mp4_bytes bigint,
  total_ms int,
  estimated_cost_usd numeric(12, 6),
  cost_per_minute_usd numeric(12, 6),
  cost_is_estimate boolean not null default true,
  cost_breakdown jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index benchmark_runs_source_idx on public.benchmark_runs (source_project_id);
create index benchmark_runs_user_id_idx on public.benchmark_runs (user_id);
create index benchmark_runs_project_id_idx on public.benchmark_runs (project_id);

alter table public.benchmark_runs enable row level security;

create policy "Users can read own benchmark runs"
  on public.benchmark_runs for select to authenticated
  using ((select auth.uid()) = user_id);

revoke insert, update, delete, truncate on public.benchmark_runs from anon, authenticated;
