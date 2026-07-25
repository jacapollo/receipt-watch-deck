-- Phase 2 (retroactive): user_follows
--
-- Introspection-verified capture of the live user_follows table. Table was
-- created out-of-band during initial Supabase setup; this file is the
-- source-of-truth going forward. Every statement is idempotent — applying
-- against the live DB is a no-op, applying to a fresh env creates it cleanly.
--
-- Live shape verified 2026-07-17 via the Supabase Management API against
-- project ajugixhwkfnnubleozdl. Column types, constraint definitions,
-- partial-unique-index shape, and policy names/expressions are byte-faithful
-- to the running schema.

create table if not exists public.user_follows (
  id          uuid        not null default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  official_id text                 references public.officials(ocd_person_id) on delete cascade,
  bill_id     uuid                 references public.bills(id) on delete cascade,
  created_at  timestamptz not null default now(),
  constraint user_follows_pkey primary key (id),
  constraint user_follows_check check (
    ((official_id is not null)::int + (bill_id is not null)::int) = 1
  )
);

-- Partial unique indexes are the real dedup guard: at most one row per
-- (user, official) and per (user, bill). Rows with the target column NULL
-- are excluded from the index entirely (that half is enforced by the CHECK).
create unique index if not exists user_follows_official_uq
  on public.user_follows(user_id, official_id) where official_id is not null;
create unique index if not exists user_follows_bill_uq
  on public.user_follows(user_id, bill_id) where bill_id is not null;
create index if not exists user_follows_user_idx
  on public.user_follows(user_id);

alter table public.user_follows enable row level security;

-- Policies wrapped so re-runs against an env that already has them are a no-op.
do $$ begin
  create policy "Own follows read"
    on public.user_follows for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Own follows insert"
    on public.user_follows for insert with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Own follows delete"
    on public.user_follows for delete using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
