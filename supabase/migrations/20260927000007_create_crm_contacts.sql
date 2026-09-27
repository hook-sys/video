create table public.crm_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  company text check (char_length(company) <= 200),
  email text check (char_length(email) <= 320),
  phone text check (char_length(phone) <= 50),
  notes text check (char_length(notes) <= 5000),
  status text not null default 'lead'
    check (status in ('lead', 'customer', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index crm_contacts_user_id_idx on public.crm_contacts (user_id);

alter table public.crm_contacts enable row level security;

create policy "Users can read own contacts"
  on public.crm_contacts for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create own contacts"
  on public.crm_contacts for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update own contacts"
  on public.crm_contacts for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete own contacts"
  on public.crm_contacts for delete to authenticated
  using ((select auth.uid()) = user_id);

create trigger crm_contacts_set_updated_at
  before update on public.crm_contacts
  for each row execute function public.set_updated_at();
