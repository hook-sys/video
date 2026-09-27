# Planned database schema (not applied)

Draft only. Migrations will live in `supabase/migrations/` once tables are built.
All tables: `id uuid pk`, `created_at`, `updated_at`; RLS enabled.

| Table | Purpose | Key fields |
|---|---|---|
| profiles | 1:1 with `auth.users` | user_id, full_name, role (`user`/`admin`) |
| plans | Pricing plans | name, price_cents, monthly_credits, is_active |
| subscriptions | User ↔ plan | user_id, plan_id, status, current_period_end |
| payments | Payment records | user_id, amount_cents, provider, provider_ref, status |
| credits | Credit ledger | user_id, delta, reason, video_id |
| projects | A video request | user_id, website_url, direction (≤500), duration, format, voice_language, voice_style |
| videos | Render output | project_id, status, script, storyboard (jsonb), output_url |
| video_scenes | Storyboard scenes | video_id, position, duration, content (jsonb), asset_url |
| ai_models | Admin-selectable models | provider, model_id, purpose, is_active |
| api_settings | Provider config (server-only) | provider, config (jsonb) — secrets stay in env/vault |
| landing_pages | CMS pages | slug, title, is_published |
| landing_sections | Page sections | page_id, position, type, content (jsonb) |

Service-role key is server-only and never prefixed `NEXT_PUBLIC_`.
