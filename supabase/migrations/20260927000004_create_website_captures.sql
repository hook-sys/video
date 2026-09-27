create table public.website_captures (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  url text not null check (url ~* '^https?://'),
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'failed')),
  error_message text,
  title text,
  meta_description text,
  visible_text text check (char_length(visible_text) <= 20000),
  screenshot_path text,
  created_at timestamptz not null default now()
);

create index website_captures_project_id_idx on public.website_captures (project_id);
create index website_captures_user_id_idx on public.website_captures (user_id);

alter table public.website_captures enable row level security;

create policy "Users can read own captures"
  on public.website_captures for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create captures for own projects"
  on public.website_captures for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = (select auth.uid())
    )
  );

-- Capture runs server-side with the user's session and writes results back.
create policy "Users can update own captures"
  on public.website_captures for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (
      screenshot_path is null
      or screenshot_path like (select auth.uid())::text || '/' || project_id::text || '/%'
    )
  );

revoke update on public.website_captures from authenticated;
grant update (url, status, error_message, title, meta_description, visible_text, screenshot_path)
  on public.website_captures to authenticated;
