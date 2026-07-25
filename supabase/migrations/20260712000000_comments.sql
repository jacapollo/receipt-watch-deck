-- Phase 3: Comments + Moderation

create table if not exists public.comments (
  id          uuid primary key default gen_random_uuid(),
  parent_type text        not null check (parent_type in ('official', 'bill')),
  parent_id   text        not null,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  handle      text        not null,
  body        text        not null check (char_length(body) between 1 and 1000),
  status      text        not null default 'published'
              check (status in ('published', 'held', 'blocked')),
  hold_reason text,
  created_at  timestamptz not null default now()
);

create table if not exists public.comment_reports (
  id          uuid primary key default gen_random_uuid(),
  comment_id  uuid not null references public.comments(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason      text not null check (reason in ('spam', 'hate', 'harassment', 'misinformation', 'other')),
  created_at  timestamptz not null default now(),
  unique(comment_id, reporter_id)
);

-- Moderator flag; set to true for the account that will run the /mod queue.
alter table public.profiles
  add column if not exists is_moderator boolean not null default false;

create index if not exists comments_parent_idx
  on public.comments(parent_type, parent_id, status, created_at desc);
create index if not exists comments_user_rate_idx
  on public.comments(user_id, created_at desc);
create index if not exists comment_reports_comment_idx
  on public.comment_reports(comment_id);

-- RLS -------------------------------------------------------------------------

alter table public.comments enable row level security;
alter table public.comment_reports enable row level security;

-- Public read: only published comments visible without a session
create policy "Public read published comments"
  on public.comments for select
  using (status = 'published');

-- Moderators see all statuses (held, blocked too)
create policy "Moderators read all comments"
  on public.comments for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_moderator = true
    )
  );

-- Moderators approve / block (update status only)
create policy "Moderators update comment status"
  on public.comments for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_moderator = true
    )
  );

-- Authors can delete their own published comments
create policy "Authors delete own published comments"
  on public.comments for delete
  using (user_id = auth.uid() and status = 'published');

-- No direct INSERT: all inserts go through the submit-comment edge function
-- which uses the service-role key and enforces rate-limits + filtering.

-- Reports
create policy "Authenticated users insert reports"
  on public.comment_reports for insert
  with check (reporter_id = auth.uid());

create policy "Moderators read all reports"
  on public.comment_reports for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_moderator = true
    )
  );

create policy "Reporters see own reports"
  on public.comment_reports for select
  using (reporter_id = auth.uid());
