-- Phase 5: My Activity hub
--
-- Adds:
--   1. saved_threads — per-user bookmark table, RLS owner-scoped (same shape
--      as thread_votes).
--   2. Two indexes to make "threads user X participated in" cheap:
--        comments_user_activity_idx  — comments by user (thread parent lookup)
--        thread_votes_user_idx       — votes by user

-- saved_threads --------------------------------------------------------------
create table if not exists public.saved_threads (
  thread_id  uuid        not null references public.threads(id) on delete cascade,
  user_id    uuid        not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);

create index if not exists saved_threads_user_idx
  on public.saved_threads(user_id, created_at desc);

alter table public.saved_threads enable row level security;

-- Policies wrapped so re-runs against an env that already has them are a no-op.
do $$ begin
  create policy "Users see own saved threads"
    on public.saved_threads for select using (user_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users save threads for themselves"
    on public.saved_threads for insert with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users unsave own saved threads"
    on public.saved_threads for delete using (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- Activity query indexes -----------------------------------------------------
create index if not exists comments_user_activity_idx
  on public.comments(user_id, parent_type, status, created_at desc);

create index if not exists thread_votes_user_idx
  on public.thread_votes(user_id, created_at desc);
