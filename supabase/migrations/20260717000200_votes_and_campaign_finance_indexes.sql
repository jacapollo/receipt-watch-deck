-- Phase 5b: hot-path indexes for /votes.
--
-- Corrected 2026-07-25 after re-verifying live schema. The original draft
-- assumed campaign_finance was a base table with no indexes; it is actually
-- a VIEW, and votes already had a primary key and a natural-key unique
-- index. Only the two vote-sort indexes are net-new here.
--
-- Live schema, verified via pg_indexes / information_schema:
--
--   campaign_finance is a VIEW:
--       SELECT c.id AS campaign_id, c.official_id, c.election_id, …
--             count(t.id)      AS contribution_count,
--             sum(t.amount)    AS total,
--             sum(t.amount) FILTER (WHERE t.is_self_funding)     AS self_funded,
--             sum(t.amount) FILTER (WHERE NOT t.is_self_funding) AS outside
--         FROM campaigns c
--         LEFT JOIN contributions t ON t.campaign_id = c.id
--        GROUP BY c.id;
--     You cannot CREATE INDEX on a view — the original per-official /
--     per-cycle indexes belong on the base tables, and both already carry
--     everything the view needs.
--
--   campaigns — indexes already present:
--       campaigns_fl_doe_account_key           UNIQUE (fl_doe_account)
--       campaigns_official_id_election_id_key  UNIQUE (official_id, election_id)
--       campaigns_official_idx                        (official_id)
--       campaigns_pkey                         PK     (id)
--
--   contributions — indexes already present:
--       contributions_campaign_idx                    (campaign_id)
--       contributions_date_idx                        (contribution_date)
--       contributions_dedup_key_key            UNIQUE (dedup_key)
--       contributions_donor_idx                       (lower(donor_name))
--       contributions_pkey                     PK     (id)
--       contributions_self_funding_idx                (campaign_id, is_self_funding)
--
--   votes — natural uniqueness and PK already present:
--       votes_individual_vote_id_key           UNIQUE (individual_vote_id)
--       votes_pkey                             PK     (id)
--     No PK alteration is needed — the surrogate `id` PK stays, and
--     individual_vote_id is guarded by its own unique index.
--
-- Indexes chosen to match the actual query paths:
--   votes.tsx:120         — .order("vote_date", { ascending: false })
--   votes.tsx:118-120     — .eq("option", option) + same order

create index if not exists votes_date_idx
  on public.votes (vote_date desc);

create index if not exists votes_option_date_idx
  on public.votes (option, vote_date desc);
