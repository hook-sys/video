-- Brief fields are written only server-side via the service role.
revoke update (brief, brief_status, brief_error) on public.projects from authenticated;
