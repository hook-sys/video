-- Server-managed (service role); not granted to authenticated.
alter table public.projects
  add column assets_status text not null default 'none'
    check (assets_status in ('none', 'preparing', 'completed', 'failed')),
  add column assets_error text,
  add column assets_manifest jsonb;
