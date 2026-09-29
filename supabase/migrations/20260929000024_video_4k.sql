-- 4K is a download option: videos render at 1080p, and a 4K copy is rendered
-- on request next to it (final-4k.mp4). Additive only.
alter table public.projects
  add column video_4k_path text,
  add column render_4k_status text not null default 'idle' check (render_4k_status in ('idle', 'processing', 'completed', 'failed')),
  add column render_4k_error text;
