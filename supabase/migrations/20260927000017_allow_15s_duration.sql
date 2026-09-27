-- Offer 15/30/60 second videos. 45 stays valid for existing projects.
alter table public.projects drop constraint projects_duration_seconds_check;
alter table public.projects add constraint projects_duration_seconds_check
  check (duration_seconds in (15, 30, 45, 60));
