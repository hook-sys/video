-- Server-managed (service role); not granted to authenticated.
alter table public.projects
  add column voice_status text not null default 'none'
    check (voice_status in ('none', 'generating', 'completed', 'failed')),
  add column voice_error text,
  add column voice_result jsonb;
