-- The free trial and one account per network (14 Nov 2026).
--
-- projects.trial: a video made on the free trial (a customer who has not
-- bought credits): no credits taken, no edits, a watermark on the video.
-- Customers cannot write projects (20261016000035), so only the server sets it.
alter table public.projects add column if not exists trial boolean not null default false;
create index if not exists projects_user_trial_idx on public.projects (user_id) where trial;

-- signup_ips: one account from each network address. Only a keyed hash of
-- the address is kept (lib/signup-ip.ts), never the address itself. Read and
-- written by the server only: RLS on, no policies, no grants to customers.
create table if not exists public.signup_ips (
  ip_hash text primary key,
  user_id uuid references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.signup_ips enable row level security;
revoke all on public.signup_ips from anon, authenticated;
