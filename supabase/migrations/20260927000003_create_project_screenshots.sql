create table public.project_screenshots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null unique,
  original_filename text not null,
  created_at timestamptz not null default now()
);

create index project_screenshots_project_id_idx on public.project_screenshots (project_id);
create index project_screenshots_user_id_idx on public.project_screenshots (user_id);

alter table public.project_screenshots enable row level security;

create policy "Users can read own screenshot records"
  on public.project_screenshots for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can add screenshots to own projects"
  on public.project_screenshots for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = (select auth.uid())
    )
    and storage_path like (select auth.uid())::text || '/' || project_id::text || '/%'
  );

create policy "Users can delete own screenshot records"
  on public.project_screenshots for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Tighten upload policy: path must be `${auth.uid()}/${own project id}/...`.
drop policy "Users can upload own screenshots" on storage.objects;

create policy "Users can upload own screenshots"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'project-screenshots'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.projects p
      where p.id::text = (storage.foldername(name))[2]
        and p.user_id = (select auth.uid())
    )
  );

-- Match the app's 5 MB limit.
update storage.buckets set file_size_limit = 5242880 where id = 'project-screenshots';
