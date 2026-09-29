-- Work queue for building the sound-effect library (public/sfx) with Fal's
-- ElevenLabs sound-effects model. Rows are queued by the team; the
-- Preview-only route /internal/sfx-jobs generates them and stores the audio
-- here until it is reviewed and committed. Service role only.
create table public.sfx_jobs (
  id bigint generated always as identity primary key,
  name text not null,
  variant integer not null default 1,
  take integer not null default 1,
  prompt text not null check (char_length(prompt) between 3 and 400),
  duration_seconds numeric(4, 2) not null check (duration_seconds between 0.5 and 30),
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed')),
  audio_b64 text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name, variant, take)
);

create index sfx_jobs_status_idx on public.sfx_jobs (status, id);

alter table public.sfx_jobs enable row level security;
revoke all on public.sfx_jobs from anon, authenticated;
