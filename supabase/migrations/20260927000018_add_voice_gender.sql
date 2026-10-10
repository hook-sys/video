-- Customer-selected voice gender, passed to the voice model via the input template.
alter table public.projects
  add column voice_gender text not null default 'male' check (voice_gender in ('male', 'female'));

grant update (voice_gender) on public.projects to authenticated;
