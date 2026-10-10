-- What the customer tells the Motion Director about the product (the form's
-- "make it yours" answers): business type, where the video is used, mood,
-- three features, and the old way it replaces. The audience has its own
-- column (target_audience). Older projects have none.
alter table public.projects add column if not exists details jsonb;
