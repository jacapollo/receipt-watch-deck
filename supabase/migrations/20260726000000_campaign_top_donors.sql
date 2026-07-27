-- Top donors for a single campaign, aggregated from receipts (contributions).
--
-- This aggregates every row in public.contributions attributed to the campaign
-- — including in-kind entries and negative refund/adjustment rows. It does NOT
-- include independent expenditures or any other outside spending.
--
-- Normalization guarantees and limitations
-- ----------------------------------------
-- The grouping key collapses every run of POSIX whitespace to a single ASCII
-- space, trims, and lowercases. Punctuation is preserved exactly and the
-- token order of the raw string is preserved. This is intentionally narrow:
--   * "Acme LLC" and "acme  llc"   -> merged (case + whitespace only)
--   * "SMITH, JOHN" and "SMITH JOHN" -> NOT merged (punctuation differs)
--   * "SMITH, JOHN" and "JOHN SMITH" -> NOT merged (token order differs)
-- The schema has no donor-type / entity-identity column, so any punctuation-
-- or reorder-based collapse risks merging distinct organizations or people
-- (e.g. "Smith, John" the person vs. "John Smith Consulting LLC"). We err on
-- the side of over-splitting rather than silently combining identities.
--
-- Security / RLS
-- --------------
-- SECURITY INVOKER + explicit search_path means the function runs with the
-- caller's role and privileges. Joining contributions to campaigns forces
-- row-level security on BOTH relations: an anon caller only sees donor totals
-- rolled up from contribution rows whose parent campaign is also visible to
-- anon. There is no privilege escalation vs. running the same SELECT directly.

create or replace function public.campaign_top_donors(
  p_campaign_id uuid,
  p_limit integer default 10
)
returns table (
  donor_name text,
  total_amount numeric,
  contribution_count bigint
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with capped as (
    -- Clamp caller-supplied limit to [1, 25]; default already 10 via signature.
    select least(greatest(coalesce(p_limit, 10), 1), 25) as lim
  ),
  cleaned as (
    -- Join to campaigns so RLS on public.campaigns also gates visibility;
    -- contributions RLS is enforced by the direct SELECT from contributions.
    select
      c.amount,
      -- Display variant: whitespace-normalized + trimmed, case/punctuation preserved.
      trim(regexp_replace(c.donor_name, '[[:space:]]+', ' ', 'g')) as cleaned_name,
      -- Grouping key: same normalization plus lowercase. Punctuation preserved.
      lower(trim(regexp_replace(c.donor_name, '[[:space:]]+', ' ', 'g'))) as norm_key
    from public.contributions c
    join public.campaigns ca on ca.id = c.campaign_id
    where c.campaign_id = p_campaign_id
      and c.donor_name is not null
      and trim(regexp_replace(c.donor_name, '[[:space:]]+', ' ', 'g')) <> ''
  ),
  per_variant as (
    -- Frequency and net amount for each (key, cleaned display variant) pair.
    select
      norm_key,
      cleaned_name,
      sum(amount) as variant_amount,
      count(*)::bigint as variant_count
    from cleaned
    group by norm_key, cleaned_name
  ),
  ranked_variants as (
    -- Choose the display spelling: most frequent cleaned variant per key,
    -- tie-break by greatest absolute variant amount, then lexical order.
    select
      norm_key,
      cleaned_name,
      variant_count,
      variant_amount,
      row_number() over (
        partition by norm_key
        order by variant_count desc, abs(variant_amount) desc, cleaned_name asc
      ) as rn
    from per_variant
  ),
  per_key as (
    -- Roll every variant of a normalized key together for the returned totals.
    select
      norm_key,
      sum(variant_amount) as total_amount,
      sum(variant_count) as contribution_count
    from per_variant
    group by norm_key
  )
  select
    rv.cleaned_name as donor_name,
    pk.total_amount,
    pk.contribution_count
  from per_key pk
  join ranked_variants rv
    on rv.norm_key = pk.norm_key
   and rv.rn = 1
  -- Drop donors whose net contribution to this campaign is zero or negative
  -- (refunds fully offsetting receipts).
  where pk.total_amount > 0
  order by pk.total_amount desc, rv.cleaned_name asc
  limit (select lim from capped);
$$;

comment on function public.campaign_top_donors(uuid, integer) is
  'Top donors (by net receipts) for a single campaign. Receipts only — excludes '
  'independent expenditures. Groups by case/whitespace-normalized donor_name; '
  'punctuation and token order are preserved to avoid merging distinct entities. '
  'SECURITY INVOKER — caller RLS gates both contributions and campaigns.';

revoke all on function public.campaign_top_donors(uuid, integer) from public;
grant execute on function public.campaign_top_donors(uuid, integer) to anon, authenticated;

notify pgrst, 'reload schema';
