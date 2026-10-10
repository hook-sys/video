-- New accounts can wait for the team's approval (app_settings
-- "require_approval"): status 'pending' until approved on /admin/users.
alter table public.profiles drop constraint if exists profiles_status_check;
alter table public.profiles add constraint profiles_status_check check (status in ('active', 'suspended', 'pending'));
