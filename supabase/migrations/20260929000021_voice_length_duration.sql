-- The video is exactly as long as its voice (plus the closing brand lockup):
-- duration_seconds is estimated from the script at creation and set from the
-- voice's word timings once it exists. Only widens the old checks.
alter table public.projects drop constraint if exists projects_duration_seconds_check;
alter table public.projects add constraint projects_duration_seconds_check
  check (duration_seconds between 5 and 90);

-- The voiceover script may be 500 characters; `direction` also carries the
-- "Visual style: …" suffix.
alter table public.projects drop constraint if exists projects_direction_check;
alter table public.projects add constraint projects_direction_check
  check (char_length(direction) between 1 and 560);
