-- Saved brand kits: a customer keeps their brand (name, colour, icon,
-- website, phone, tagline) once on /brand and picks it for each new video
-- instead of uploading the icon again. Read by its owner; written only by
-- the server (app/brand/actions.ts, app/projects/v2-actions.ts) with the
-- service role, like projects (20261016000035). The icon is kept in the
-- private project-screenshots bucket at `${user}/brand-kits/${kit}.${ext}`.
create table public.brand_kits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  color text check (color is null or color ~ '^#[0-9A-Fa-f]{6}$'),
  logo_path text,
  website_url text check (website_url is null or char_length(website_url) <= 300),
  phone text check (phone is null or char_length(phone) <= 30),
  tagline text check (tagline is null or char_length(tagline) <= 120),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index brand_kits_user_id_idx on public.brand_kits (user_id);
-- one default kit per customer
create unique index brand_kits_one_default on public.brand_kits (user_id) where is_default;

alter table public.brand_kits enable row level security;

create policy "Users can read own brand kits"
  on public.brand_kits for select to authenticated
  using ((select auth.uid()) = user_id);

revoke insert, update, delete on public.brand_kits from anon, authenticated;
