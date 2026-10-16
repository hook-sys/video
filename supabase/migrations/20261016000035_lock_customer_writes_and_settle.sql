-- 1. Customers write no project or profile rows themselves.
-- Every project is created and changed by the server (service role): the
-- new video form (app/projects/actions.ts, app/projects/v2-actions.ts) and
-- the pipeline. A customer with the anon key could otherwise insert a
-- project with any column set (credits_charged, pipeline_status, brief…) or
-- change one. Profiles are made by the sign-up trigger (security definer);
-- a customer may still change only their own full_name.
revoke insert, update on public.projects from anon, authenticated;
revoke insert on public.profiles from anon, authenticated;

-- 2. A video's credits given back or settled once, never twice.
-- Locks the project's row, reads what it holds from the ledger (video,
-- refund and adjust rows) and moves the difference to p_due in one
-- transaction: a second call at the same moment waits, then sees nothing
-- left to move. Returns what the project held before the call.
create function public.project_credit_settle(
  p_project uuid,
  p_user uuid,
  p_due integer,
  p_kind text,
  p_note text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_held integer;
begin
  if p_due < 0 or p_kind not in ('refund', 'adjust') then
    raise exception 'invalid_settle' using errcode = '22023';
  end if;
  perform 1 from public.projects where id = p_project and user_id = p_user for update;
  if not found then
    raise exception 'project_not_found' using errcode = 'P0002';
  end if;
  select coalesce(-sum(delta), 0)::integer into v_held
    from public.credit_ledger
    where project_id = p_project and kind in ('video', 'refund', 'adjust');
  if v_held <= 0 or v_held = p_due then
    return v_held;
  end if;
  perform public.credit_change(p_user, v_held - p_due, p_kind, p_note, p_project, null, null, null, true);
  update public.projects set credits_charged = p_due where id = p_project;
  return v_held;
end;
$$;
revoke execute on function public.project_credit_settle(uuid, uuid, integer, text, text) from public, anon, authenticated;
