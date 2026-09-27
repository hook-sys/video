-- Private bucket for generated audio: `${user_id}/${project_id}/voice/...`
-- Written only by the server (service role); owners may read their own files.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('project-audio', 'project-audio', false, 26214400,
        array['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave',
              'audio/ogg', 'audio/opus', 'audio/aac', 'audio/mp4', 'audio/x-m4a',
              'audio/flac', 'audio/webm']);

create policy "Users can read own audio"
  on storage.objects for select to authenticated
  using (bucket_id = 'project-audio'
         and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Drop temporary provider URLs from existing voice results.
update public.projects set voice_result = voice_result - 'audioUrl'
where voice_result ? 'audioUrl';
