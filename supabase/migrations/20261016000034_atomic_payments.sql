-- Payments and coupons, each in one transaction.
--
-- finish_payment(): marks a pending payment paid AND grants its credits (and
-- its coupon bonus, and records the coupon's use) together — if any step
-- fails, nothing is kept and the payment stays pending, so Stripe's retry
-- (or the customer coming back) can credit it. A payment is credited once:
-- only the call that moves it from pending to paid grants anything.
--
-- start_payment(): a purchase with a coupon checks the coupon's limits with
-- the coupon's row locked and inserts the payment in the same transaction,
-- so two checkouts at once can't both pass the last use. An open checkout
-- (pending, under 40 minutes old — sessions expire after 30) holds its use.
--
-- redeem_coupon(): a code that gives credits outright — locked check, the
-- redemption and the credits in one transaction.
--
-- Errors are raised with these messages (the app maps them to text):
-- coupon_invalid, coupon_expired, coupon_wrong_kind, coupon_min_usd,
-- coupon_used_up, coupon_used_by_you.

-- A checkout still open holds its coupon use this long.
create function public.coupon_hold()
returns interval
language sql
immutable
set search_path = ''
as $$ select interval '40 minutes' $$;

-- The coupon's limits for this customer (the caller holds the coupon's row
-- lock). p_payment: a payment already counted (left out of the holds).
create function public.coupon_check(p_coupon public.coupons, p_user uuid, p_payment uuid default null)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_used integer;
  v_mine integer;
begin
  if p_coupon.id is null or not p_coupon.active then
    raise exception 'coupon_invalid' using errcode = 'P0001';
  end if;
  if p_coupon.expires_at is not null and p_coupon.expires_at < now() then
    raise exception 'coupon_expired' using errcode = 'P0001';
  end if;
  select
    (select count(*) from public.coupon_redemptions r where r.coupon_id = p_coupon.id)
    + (select count(*) from public.payments p
        where p.coupon_id = p_coupon.id and p.status = 'pending' and p.created_at > now() - public.coupon_hold()
          and p.id is distinct from p_payment),
    (select count(*) from public.coupon_redemptions r where r.coupon_id = p_coupon.id and r.user_id = p_user)
    + (select count(*) from public.payments p
        where p.coupon_id = p_coupon.id and p.user_id = p_user and p.status = 'pending' and p.created_at > now() - public.coupon_hold()
          and p.id is distinct from p_payment)
  into v_used, v_mine;
  if p_coupon.max_uses is not null and v_used >= p_coupon.max_uses then
    raise exception 'coupon_used_up' using errcode = 'P0001';
  end if;
  if p_coupon.per_user_once and v_mine > 0 then
    raise exception 'coupon_used_by_you' using errcode = 'P0001';
  end if;
end;
$$;

-- A purchase started: the payment row (pending), its coupon checked under lock.
create function public.start_payment(
  p_user uuid,
  p_usd numeric,
  p_list_usd numeric,
  p_credits integer,
  p_bonus integer,
  p_coupon uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_coupon public.coupons;
  v_id uuid;
begin
  if p_coupon is not null then
    select * into v_coupon from public.coupons where id = p_coupon for update;
    if not found then
      raise exception 'coupon_invalid' using errcode = 'P0001';
    end if;
    if v_coupon.kind = 'credits' then
      raise exception 'coupon_wrong_kind' using errcode = 'P0001';
    end if;
    if v_coupon.min_usd > p_list_usd then
      raise exception 'coupon_min_usd' using errcode = 'P0001';
    end if;
    perform public.coupon_check(v_coupon, p_user);
  end if;
  insert into public.payments (user_id, usd, list_usd, credits, bonus, coupon_id)
    values (p_user, p_usd, p_list_usd, p_credits, p_bonus, p_coupon)
    returning id into v_id;
  return v_id;
end;
$$;

-- A paid purchase credited — once, in one transaction. False when it was
-- already credited (or is not pending).
create function public.finish_payment(p_payment uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.payments;
begin
  update public.payments
    set status = 'paid', paid_at = now()
    where id = p_payment and status = 'pending'
    returning * into v;
  if not found then
    return false;
  end if;
  perform public.credit_change(v.user_id, v.credits, 'purchase',
    'Bought ' || to_char(v.credits, 'FM999,999,999,990') || ' credits ($' || to_char(v.usd, 'FM999,999,990.00') || ')',
    null, v.id, null, null, false);
  if v.bonus > 0 then
    perform public.credit_change(v.user_id, v.bonus, 'bonus', 'Coupon bonus', null, v.id, v.coupon_id, null, false);
  end if;
  if v.coupon_id is not null then
    -- (the customer has paid: the use is recorded even past a limit — its hold was checked when the checkout started)
    perform 1 from public.coupons where id = v.coupon_id for update;
    insert into public.coupon_redemptions (coupon_id, user_id, credits, payment_id) values (v.coupon_id, v.user_id, v.bonus, v.id);
    update public.coupons set uses = (select count(*) from public.coupon_redemptions r where r.coupon_id = v.coupon_id) where id = v.coupon_id;
  end if;
  return true;
end;
$$;

-- A code that gives credits outright: the credits given.
create function public.redeem_coupon(p_user uuid, p_code text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_coupon public.coupons;
begin
  select * into v_coupon from public.coupons where code = upper(trim(p_code)) for update;
  if not found then
    raise exception 'coupon_invalid' using errcode = 'P0001';
  end if;
  if v_coupon.kind <> 'credits' then
    raise exception 'coupon_wrong_kind' using errcode = 'P0001';
  end if;
  perform public.coupon_check(v_coupon, p_user);
  perform public.credit_change(p_user, v_coupon.value, 'coupon', 'Code ' || v_coupon.code, null, null, v_coupon.id, null, false);
  insert into public.coupon_redemptions (coupon_id, user_id, credits, payment_id) values (v_coupon.id, p_user, v_coupon.value, null);
  update public.coupons set uses = (select count(*) from public.coupon_redemptions r where r.coupon_id = v_coupon.id) where id = v_coupon.id;
  return v_coupon.value;
end;
$$;

-- Server only (service role), like credit_change.
revoke execute on function public.coupon_hold() from public, anon, authenticated;
revoke execute on function public.coupon_check(public.coupons, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.start_payment(uuid, numeric, numeric, integer, integer, uuid) from public, anon, authenticated;
revoke execute on function public.finish_payment(uuid) from public, anon, authenticated;
revoke execute on function public.redeem_coupon(uuid, text) from public, anon, authenticated;
