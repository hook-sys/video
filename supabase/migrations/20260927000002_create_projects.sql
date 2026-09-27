create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  website_url text,
  direction text not null check (char_length(direction) between 1 and 500),
  duration_seconds int not null check (duration_seconds in (30, 45, 60)),
  format text not null check (format in ('16:9', '9:16', '1:1')),
  voice_language text not null,
  voice_style text not null
    check (voice_style in ('Professional', 'Friendly', 'Energetic', 'Calm', 'Premium')),
  status text not null default 'draft'
    check (status in ('draft', 'processing', 'completed', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_user_id_idx on public.projects (user_id);

alter table public.projects enable row level security;

create policy "Users can read own projects"
  on public.projects for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create own projects"
  on public.projects for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update own projects"
  on public.projects for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete own projects"
  on public.projects for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Status is system-managed; users may not change it directly.
revoke update on public.projects from authenticated;
grant update (website_url, direction, duration_seconds, format, voice_language, voice_style)
  on public.projects to authenticated;

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- Private bucket for future screenshot uploads: `${user_id}/${project_id}/${file}`
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('project-screenshots', 'project-screenshots', false, 10485760,
        array['image/png', 'image/jpeg', 'image/webp']);

create policy "Users can read own screenshots"
  on storage.objects for select to authenticated
  using (bucket_id = 'project-screenshots'
         and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can upload own screenshots"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'project-screenshots'
              and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can delete own screenshots"
  on storage.objects for delete to authenticated
  using (bucket_id = 'project-screenshots'
         and (storage.foldername(name))[1] = (select auth.uid())::text);
