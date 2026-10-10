-- Richer customer direction: the video direction becomes a full brief (it was
-- a 300-character hint), plus brand inputs. All additive with neutral
-- defaults, so existing projects and code keep working.
alter table public.projects drop constraint if exists projects_advanced_direction_check;
alter table public.projects
  add constraint projects_advanced_direction_check check (char_length(advanced_direction) <= 1500),
  add column brand_name text not null default ''
    check (char_length(brand_name) <= 60),
  add column brand_color text
    check (brand_color is null or brand_color ~ '^#[0-9A-Fa-f]{6}$'),
  add column call_to_action text not null default ''
    check (char_length(call_to_action) <= 60),
  add column target_audience text not null default ''
    check (char_length(target_audience) <= 200);

grant update (brand_name, brand_color, call_to_action, target_audience) on public.projects to authenticated;

-- Direction library: every customer's direction (what they asked for) next to
-- what the AI director made of it, kept even if the project is deleted, as
-- the data the product learns from (examples, evaluation, fine-tuning).
-- Server-managed: written with the service role only; customers can read
-- their own rows.
create table public.direction_library (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  project_id uuid references public.projects (id) on delete set null,
  user_id uuid references auth.users (id) on delete set null,
  voice_script text not null,
  video_direction text not null,
  visual_style text,
  creative_direction text,
  motion_level text,
  visual_density text,
  format text,
  duration_seconds integer,
  voice_language text,
  brand_name text,
  brand_color text,
  call_to_action text,
  target_audience text,
  has_logo boolean not null default false,
  screenshot_count integer not null default 0,
  -- Filled in as the pipeline runs.
  narration text,
  flow_script jsonb,
  outcome jsonb
);

create index direction_library_user_id_idx on public.direction_library (user_id);
create index direction_library_project_id_idx on public.direction_library (project_id);

alter table public.direction_library enable row level security;

create policy "Users can read own directions"
  on public.direction_library for select to authenticated
  using (user_id = (select auth.uid()));

revoke insert, update, delete, truncate on public.direction_library from anon, authenticated;
