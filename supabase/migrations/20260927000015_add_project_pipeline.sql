-- Automatic generation pipeline state. Server-managed (service role); not
-- granted to authenticated.
alter table public.projects
  add column pipeline_status text not null default 'idle'
    check (pipeline_status in ('idle', 'running', 'needs_input', 'failed', 'preview_ready', 'completed')),
  add column pipeline_step text
    check (pipeline_step in ('analyzing', 'writing', 'voice', 'visuals', 'validating', 'rendering')),
  add column pipeline_error text;
