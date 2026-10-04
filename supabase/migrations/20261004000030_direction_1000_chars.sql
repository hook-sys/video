-- The voiceover script may be up to 1000 characters (a ~60 s video); the
-- direction column also holds a short suffix (visual style, look, voice).
alter table public.projects drop constraint if exists projects_direction_check;
alter table public.projects add constraint projects_direction_check
  check (char_length(direction) between 1 and 1100);
