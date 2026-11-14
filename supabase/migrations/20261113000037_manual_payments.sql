-- Manual payments (bKash, Nagad, Rocket): the customer sends money to the
-- number on /billing, then submits the method, their number, the amount and
-- the transaction ID. A payment row waits as 'pending' until the team checks
-- it on /admin/billing: approved → 'paid' and the credits added (once, by
-- finishPayment); rejected → 'failed' with a note. A transaction ID is
-- accepted once per method. Rows are still written by the server only.
alter table public.payments
  add column method text check (method is null or method in ('stripe', 'bkash', 'nagad', 'rocket')),
  add column trx_id text check (trx_id is null or char_length(trx_id) between 4 and 40),
  add column sender text check (sender is null or char_length(sender) <= 20),
  add column bdt numeric(12, 2) check (bdt is null or bdt >= 0),
  add column review_note text check (review_note is null or char_length(review_note) <= 300),
  add column reviewed_by uuid references public.profiles (id) on delete set null,
  add column reviewed_at timestamptz;

create unique index payments_method_trx_unique on public.payments (method, upper(trx_id)) where trx_id is not null;
create index payments_pending_idx on public.payments (created_at) where status = 'pending';
