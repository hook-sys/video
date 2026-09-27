-- Render state is server-managed (service role); not granted to authenticated.
alter table public.projects
  add column render_status text not null default 'idle'
    check (render_status in ('idle', 'processing', 'completed', 'failed')),
  add column render_error text,
  add column video_path text,
  -- Chosen when a render starts (server-written); later used to price renders (4K costs more).
  add column resolution text not null default '1080p'
    check (resolution in ('1080p', '4k'));

-- Private bucket for final videos: `${user_id}/${project_id}/final.mp4`.
-- Written only by the server; owners may read their own files.
-- 500 MB allows 4K; the Supabase project's global upload limit also applies.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('project-videos', 'project-videos', false, 524288000, array['video/mp4']);

create policy "Users can read own videos"
  on storage.objects for select to authenticated
  using (bucket_id = 'project-videos'
         and (storage.foldername(name))[1] = (select auth.uid())::text);
