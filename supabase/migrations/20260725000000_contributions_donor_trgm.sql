-- Trigram GIN index on contributions.donor_name for substring ILIKE search.
--
-- The existing contributions_donor_idx is a btree on lower(donor_name); that
-- only accelerates left-anchored predicates (e.g. lower(donor_name) LIKE
-- 'pac%'). The donor-search query issues raw ILIKE '%<term>%' against
-- donor_name, which is unanchored substring matching and therefore cannot use
-- a btree. pg_trgm's gin_trgm_ops handles arbitrary ILIKE / LIKE substring
-- predicates by indexing trigrams of the raw column value.

create extension if not exists pg_trgm;

create index if not exists contributions_donor_trgm_idx
  on public.contributions using gin (donor_name gin_trgm_ops);
