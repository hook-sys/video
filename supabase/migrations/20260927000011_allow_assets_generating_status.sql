alter table public.projects drop constraint projects_assets_status_check;
alter table public.projects add constraint projects_assets_status_check
  check (assets_status in ('none', 'preparing', 'generating', 'completed', 'failed'));
