-- Credits, coupons and payments (pay per use), and the admin team.
--
-- profiles.credits: the balance. Every change goes through credit_change()
-- and is written to credit_ledger (who, why, the balance after), so the
-- balance is never edited by hand and can always be explained.
-- coupons / coupon_redemptions: codes the team makes (a discount or extra
-- credits on a purchase, or credits given outright).
-- payments: Stripe Checkout purchases (credited once, by the webhook).
-- projects.quality / credits_charged: the level a video was made at and
-- what it holds of the customer's credits (given back if it fails).
-- profiles.role gains the team roles; profiles.admin_active turns a team
-- member's admin access off without suspending their account.
-- New tables are server-managed (service role); a customer reads only their own.

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('user', 'admin', 'super_admin', 'support', 'finance', 'content'));
alter table public.profiles
  add column credits integer not null default 0,
  add column admin_active boolean not null default true;

alter table public.projects
  add column quality text not null default 'standard' check (quality in ('standard', 'pro', 'ultra')),
  add column credits_charged integer not null default 0 check (credits_charged >= 0);

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9_-]{3,32}$'),
  -- discount: % off a purchase · bonus: % more credits on a purchase · credits: credits given outright
  kind text not null check (kind in ('discount', 'bonus', 'credits')),
  value integer not null check (value > 0 and value <= 100000),
  active boolean not null default true,
  expires_at timestamptz,
  max_uses integer check (max_uses is null or max_uses > 0),
  per_user_once boolean not null default true,
  min_usd numeric(10, 2) not null default 0 check (min_usd >= 0),
  uses integer not null default 0,
  note text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  stripe_session_id text unique,
  usd numeric(10, 2) not null check (usd >= 0),
  list_usd numeric(10, 2) not null check (list_usd >= 0),
  credits integer not null check (credits >= 0),
  bonus integer not null default 0 check (bonus >= 0),
  coupon_id uuid references public.coupons (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index payments_user_idx on public.payments (user_id, created_at desc);

create table public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  payment_id uuid references public.payments (id) on delete set null,
  credits integer not null default 0,
  created_at timestamptz not null default now()
);
create index coupon_redemptions_coupon_idx on public.coupon_redemptions (coupon_id);
create index coupon_redemptions_user_idx on public.coupon_redemptions (user_id);

create table public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  delta integer not null,
  balance_after integer not null,
  -- signup · purchase · bonus · coupon · video · refund · adjust · admin
  kind text not null check (kind in ('signup', 'purchase', 'bonus', 'coupon', 'video', 'refund', 'adjust', 'admin')),
  note text,
  project_id uuid references public.projects (id) on delete set null,
  payment_id uuid references public.payments (id) on delete set null,
  coupon_id uuid references public.coupons (id) on delete set null,
  actor_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index credit_ledger_user_idx on public.credit_ledger (user_id, created_at desc);
-- the sign-up credits are given once
create unique index credit_ledger_signup_once on public.credit_ledger (user_id) where kind = 'signup';

-- The one way a balance changes: atomic, logged, and (unless allowed) never below zero.
create function public.credit_change(
  p_user uuid,
  p_delta integer,
  p_kind text,
  p_note text default null,
  p_project uuid default null,
  p_payment uuid default null,
  p_coupon uuid default null,
  p_actor uuid default null,
  p_allow_negative boolean default false
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balance integer;
begin
  update public.profiles
    set credits = credits + p_delta
    where id = p_user and (p_allow_negative or p_delta >= 0 or credits + p_delta >= 0)
    returning credits into v_balance;
  if v_balance is null then
    raise exception 'insufficient_credits' using errcode = 'P0001';
  end if;
  insert into public.credit_ledger (user_id, delta, balance_after, kind, note, project_id, payment_id, coupon_id, actor_id)
    values (p_user, p_delta, v_balance, p_kind, p_note, p_project, p_payment, p_coupon, p_actor);
  return v_balance;
end;
$$;
revoke execute on function public.credit_change(uuid, integer, text, text, uuid, uuid, uuid, uuid, boolean) from public, anon, authenticated;

alter table public.coupons enable row level security;
alter table public.payments enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.credit_ledger enable row level security;
revoke all on public.coupons from anon, authenticated;
revoke all on public.coupon_redemptions from anon, authenticated;
revoke all on public.payments from anon, authenticated;
revoke all on public.credit_ledger from anon, authenticated;
grant select on public.payments to authenticated;
grant select on public.credit_ledger to authenticated;
create policy "Users read own payments" on public.payments for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users read own credit history" on public.credit_ledger for select to authenticated using ((select auth.uid()) = user_id);

-- What a video holds of the credits is set by the server only (a customer
-- inserting a project directly never sets it).
create function public.projects_no_client_charge()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.credits_charged := 0;
  end if;
  return new;
end;
$$;
create trigger projects_no_client_charge
  before insert on public.projects
  for each row execute function public.projects_no_client_charge();
