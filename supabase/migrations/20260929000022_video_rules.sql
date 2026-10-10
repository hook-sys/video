-- The "never do this" rulebook for video composition (lib/video-rules.ts)
-- and the mistakes found in every generated video.
--
-- video_rules: rules added without a deploy (id, the "never …" line the
--   Director is told). Active rows are appended to the built-in rules.
-- video_mistakes: one row per rule a video broke, written by the pipeline
--   after the Director runs. The rules broken most often in the last 30 days
--   are listed first and stressed in the Director's prompt.
-- Server-managed: service role only (RLS on, no policies).

create table public.video_rules (
  id text primary key check (id ~ '^[a-z0-9-]{2,40}$'),
  never text not null check (char_length(never) between 10 and 300),
  active boolean not null default true,
  note text,
  created_at timestamptz not null default now()
);

create table public.video_mistakes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  project_id uuid references public.projects (id) on delete set null,
  rule_id text not null,
  detail text,
  source text not null default 'detector'
);

create index video_mistakes_created_at_idx on public.video_mistakes (created_at desc);
create index video_mistakes_project_id_idx on public.video_mistakes (project_id);

alter table public.video_rules enable row level security;
alter table public.video_mistakes enable row level security;

revoke all on public.video_rules from anon, authenticated;
revoke all on public.video_mistakes from anon, authenticated;
