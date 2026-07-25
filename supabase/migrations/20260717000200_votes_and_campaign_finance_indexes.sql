-- Phase 5b: hot-path indexes for /votes and /money
--
-- Both tables live in the live DB but were created out-of-band (same as
-- user_follows before it was captured). At introspection time both had
-- ZERO indexes and no primary key, so every query — including the
-- pagination on /votes — was doing a full seq scan.
--
-- Rowcount at capture: votes = 97,910 · campaign_finance = 293.
--
-- Natural-key uniqueness verified 2026-07-17:
--   votes.individual_vote_id       — 97910 distinct / 0 dupes / 0 nulls
--   campaign_finance.campaign_id   —   293 distinct / 0 dupes / 0 nulls
--
-- Indexes chosen to match the actual query paths:
--   votes.tsx:120         — .order("vote_date", { ascending: false })
--   votes.tsx:118-120     — .eq("option", option) + same order
--   records.ts:354        — .eq("official_id", …) on campaign_finance
--   money.tsx / records   — election-cycle rollups and cycle filters

-- Primary keys -----------------------------------------------------------------
-- Wrapped so re-runs (or fresh envs where the PK was declared inline in a
-- table create) don't hard-fail.
do $$ begin
  alter table public.votes
    add constraint votes_pkey primary key (individual_vote_id);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.campaign_finance
    add constraint campaign_finance_pkey primary key (campaign_id);
exception when duplicate_object then null; end $$;

-- Hot-path indexes -------------------------------------------------------------
-- votes: default sort is vote_date DESC; option filter narrows to a subset
-- and keeps the same sort.
create index if not exists votes_date_idx
  on public.votes (vote_date desc);

create index if not exists votes_option_date_idx
  on public.votes (option, vote_date desc);

-- campaign_finance: per-official queries (records.ts:354) and cycle-level
-- lookups / rollups.
create index if not exists campaign_finance_official_election_idx
  on public.campaign_finance (official_id, election_id);

create index if not exists campaign_finance_election_idx
  on public.campaign_finance (election_id);
