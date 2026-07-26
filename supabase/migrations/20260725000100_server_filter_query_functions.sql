-- Stable, read-only RPCs used by the Votes exact-count display and the
-- campaign-finance leaderboard. The underlying tables/views are public data.
-- Security-definer avoids PostgREST's per-request count plan, which exceeds the
-- hosted statement timeout for high-cardinality vote filters and the aggregate
-- campaign_finance view even though the equivalent SQL completes quickly.

create or replace function public.count_votes_filtered(
  p_option text default null,
  p_chamber text default null,
  p_official_search text default null,
  p_bill_search text default null
)
returns bigint
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*)::bigint
  from public.votes v
  where (p_option is null or v.option = p_option)
    and (p_chamber is null or v.chamber = p_chamber)
    and (
      p_official_search is null
      or exists (
        select 1
        from public.officials o
        where o.ocd_person_id = v.official_id
          and o.full_name ilike ('%' || p_official_search || '%')
      )
    )
    and (
      p_bill_search is null
      or exists (
        select 1
        from public.bills b
        where b.id = v.bill_id
          and (b.identifier ilike ('%' || p_bill_search || '%')
            or b.title ilike ('%' || p_bill_search || '%'))
      )
    );
$$;

revoke all on function public.count_votes_filtered(text, text, text, text) from public;
grant execute on function public.count_votes_filtered(text, text, text, text) to anon, authenticated;

create or replace function public.campaign_finance_page(
  p_party_values text[] default null,
  p_office text default null,
  p_election text default null,
  p_sort text default 'outside',
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  campaign_id uuid,
  official_id text,
  election_id text,
  fl_doe_account integer,
  office_as_filed text,
  district_as_filed text,
  party_as_filed text,
  campaign_source jsonb,
  contribution_count bigint,
  total numeric,
  self_funded numeric,
  outside numeric,
  filtered_count bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with filtered as (
    select
      cf.campaign_id,
      cf.official_id,
      cf.election_id,
      cf.fl_doe_account,
      cf.office_as_filed,
      cf.district_as_filed,
      cf.party_as_filed,
      cf.campaign_source,
      cf.contribution_count::bigint,
      cf.total,
      cf.self_funded,
      cf.outside,
      count(*) over ()::bigint as filtered_count
    from public.campaign_finance cf
    where (p_party_values is null or cf.party_as_filed = any (p_party_values))
      and (p_office is null or cf.office_as_filed = p_office)
      and (p_election is null or cf.election_id = p_election)
  )
  select *
  from filtered
  order by
    case when p_sort = 'self_funded' then filtered.self_funded end desc nulls last,
    case when p_sort <> 'self_funded' then filtered.outside end desc nulls last,
    filtered.campaign_id asc
  limit greatest(1, least(coalesce(p_limit, 25), 100))
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.campaign_finance_page(text[], text, text, text, integer, integer) from public;
grant execute on function public.campaign_finance_page(text[], text, text, text, integer, integer) to anon, authenticated;

notify pgrst, 'reload schema';
