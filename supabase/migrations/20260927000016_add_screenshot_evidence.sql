-- Evidence extracted from uploaded screenshots by OpenAI vision. Server-managed
-- (service role); not granted to authenticated.
alter table public.projects add column screenshot_evidence jsonb;
