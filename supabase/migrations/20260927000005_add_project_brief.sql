alter table public.projects
  add column brief jsonb,
  add column brief_status text not null default 'none'
    check (brief_status in ('none', 'generating', 'completed', 'failed')),
  add column brief_error text;

-- Brief is generated server-side with the user's session.
grant update (brief, brief_status, brief_error) on public.projects to authenticated;
