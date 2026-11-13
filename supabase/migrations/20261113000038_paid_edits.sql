-- Paid edits: a finished video's first saved edit is free, each one after
-- costs credits (set on /admin/billing; 15 to start). projects.edit_count is
-- how many edits were saved (going back to the video as made counts as one);
-- the charge is a credit_ledger row of kind 'edit' (given back the same way
-- if the save fails). Videos already edited count as one edit.
alter table public.credit_ledger drop constraint credit_ledger_kind_check;
alter table public.credit_ledger add constraint credit_ledger_kind_check
  check (kind in ('signup', 'purchase', 'bonus', 'coupon', 'video', 'refund', 'adjust', 'admin', 'edit'));

alter table public.projects add column edit_count integer not null default 0 check (edit_count >= 0);
update public.projects set edit_count = 1 where brief -> 'composer' ? 'edited';
