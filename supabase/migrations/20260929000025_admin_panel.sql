-- Super admin panel (/admin).
--
-- profiles.role gains 'super_admin' (can change roles; 'admin' can do the rest).
-- admin_audit_log: every admin action (who, what, on which record).
-- app_settings: key → JSON value, edited from /admin/settings.
-- plans: subscription plans (structure only; no payment provider yet).
-- profiles.plan_id: the plan a user is on (null = free).
-- All three new tables are server-managed: service role only (RLS on, no policies).

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('user', 'admin', 'super_admin'));

create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_id uuid references public.profiles (id) on delete set null,
  actor_email text,
  action text not null,
  target_type text,
  target_id text,
  detail jsonb not null default '{}'
);
create index admin_audit_log_created_at_idx on public.admin_audit_log (created_at desc);

create table public.app_settings (
  key text primary key check (key ~ '^[a-z0-9_]{2,60}$'),
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

insert into public.app_settings (key, value) values
  ('signups_enabled', 'true'),
  ('maintenance_mode', 'false'),
  ('maintenance_message', '"MotionBrief is getting an upgrade. Back soon."'),
  ('support_email', '"support@motionbrief.io"'),
  ('feature_4k', 'true'),
  ('feature_sfx', 'true'),
  ('max_videos_per_day', '20');

create table public.plans (
  id text primary key check (id ~ '^[a-z0-9-]{2,40}$'),
  name text not null,
  price_usd_month numeric(10, 2) not null default 0 check (price_usd_month >= 0),
  videos_per_month integer not null default 0 check (videos_per_month >= 0),
  allow_4k boolean not null default false,
  active boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);

insert into public.plans (id, name, price_usd_month, videos_per_month, allow_4k, sort) values
  ('free', 'Free', 0, 2, false, 0),
  ('pro', 'Pro', 29, 20, true, 1),
  ('business', 'Business', 99, 100, true, 2);

alter table public.profiles
  add column plan_id text references public.plans (id) on delete set null;

alter table public.admin_audit_log enable row level security;
alter table public.app_settings enable row level security;
alter table public.plans enable row level security;
revoke all on public.admin_audit_log from anon, authenticated;
revoke all on public.app_settings from anon, authenticated;
revoke all on public.plans from anon, authenticated;

-- The owner's account is the first super admin.
update public.profiles set role = 'super_admin' where email = 'hmsolyman33@gmail.com';
