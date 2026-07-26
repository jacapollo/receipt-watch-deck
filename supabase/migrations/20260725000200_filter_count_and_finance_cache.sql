-- Fast, exact projections for the public filtering UI.
--
-- The hosted anon role has a 3-second statement timeout. Exact PostgREST counts
-- over the high-cardinality votes filters and repeated aggregation of the
-- campaign_finance view can exceed it. These transactionally maintained summary
-- tables preserve exact results without adding the rejected chamber/date index.

-- ---------------------------------------------------------------------------
-- Exact vote counts for option/chamber-only filters

create table if not exists public.vote_filter_counts (
  chamber_key text not null,
  option_key text not null,
  exact_count bigint not null default 0,
  primary key (chamber_key, option_key),
  check (exact_count >= 0)
);

lock table public.votes in share row exclusive mode;

truncate public.vote_filter_counts;

insert into public.vote_filter_counts (chamber_key, option_key, exact_count)
select '*', '*', count(*)::bigint from public.votes
union all
select chamber, '*', count(*)::bigint from public.votes where chamber is not null group by chamber
union all
select '*', option, count(*)::bigint from public.votes where option is not null group by option
union all
select chamber, option, count(*)::bigint
from public.votes
where chamber is not null and option is not null
group by chamber, option;

create or replace function public.adjust_vote_filter_counts(
  p_chamber text,
  p_option text,
  p_delta integer
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.vote_filter_counts (chamber_key, option_key, exact_count)
  values ('*', '*', p_delta)
  on conflict (chamber_key, option_key)
  do update set exact_count = public.vote_filter_counts.exact_count + excluded.exact_count;

  if p_chamber is not null then
    insert into public.vote_filter_counts (chamber_key, option_key, exact_count)
    values (p_chamber, '*', p_delta)
    on conflict (chamber_key, option_key)
    do update set exact_count = public.vote_filter_counts.exact_count + excluded.exact_count;
  end if;

  if p_option is not null then
    insert into public.vote_filter_counts (chamber_key, option_key, exact_count)
    values ('*', p_option, p_delta)
    on conflict (chamber_key, option_key)
    do update set exact_count = public.vote_filter_counts.exact_count + excluded.exact_count;
  end if;

  if p_chamber is not null and p_option is not null then
    insert into public.vote_filter_counts (chamber_key, option_key, exact_count)
    values (p_chamber, p_option, p_delta)
    on conflict (chamber_key, option_key)
    do update set exact_count = public.vote_filter_counts.exact_count + excluded.exact_count;
  end if;
end;
$$;

create or replace function public.maintain_vote_filter_counts()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    perform public.adjust_vote_filter_counts(new.chamber, new.option, 1);
    return new;
  elsif tg_op = 'DELETE' then
    perform public.adjust_vote_filter_counts(old.chamber, old.option, -1);
    return old;
  end if;

  perform public.adjust_vote_filter_counts(old.chamber, old.option, -1);
  perform public.adjust_vote_filter_counts(new.chamber, new.option, 1);
  return new;
end;
$$;

drop trigger if exists votes_filter_counts_trigger on public.votes;
create trigger votes_filter_counts_trigger
after insert or delete or update of chamber, option on public.votes
for each row execute function public.maintain_vote_filter_counts();

create or replace function public.count_votes_filtered(
  p_option text default null,
  p_chamber text default null,
  p_official_search text default null,
  p_bill_search text default null
)
returns bigint
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  result bigint;
begin
  if p_official_search is null and p_bill_search is null then
    select exact_count into result
    from public.vote_filter_counts
    where chamber_key = coalesce(p_chamber, '*')
      and option_key = coalesce(p_option, '*');
    return coalesce(result, 0);
  end if;

  select count(*)::bigint into result
  from public.votes v
  where (p_option is null or v.option = p_option)
    and (p_chamber is null or v.chamber = p_chamber)
    and (
      p_official_search is null
      or exists (
        select 1 from public.officials o
        where o.ocd_person_id = v.official_id
          and o.full_name ilike ('%' || p_official_search || '%')
      )
    )
    and (
      p_bill_search is null
      or exists (
        select 1 from public.bills b
        where b.id = v.bill_id
          and (b.identifier ilike ('%' || p_bill_search || '%')
            or b.title ilike ('%' || p_bill_search || '%'))
      )
    );
  return result;
end;
$$;

revoke all on function public.adjust_vote_filter_counts(text, text, integer) from public;
revoke all on function public.maintain_vote_filter_counts() from public;
revoke all on function public.count_votes_filtered(text, text, text, text) from public;
grant execute on function public.count_votes_filtered(text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Incremental campaign-finance aggregate projection

create table if not exists public.campaign_finance_totals (
  campaign_id uuid primary key references public.campaigns(id) on delete cascade,
  contribution_count bigint not null default 0,
  total numeric not null default 0,
  self_funded numeric not null default 0,
  outside numeric not null default 0,
  check (contribution_count >= 0)
);

lock table public.contributions in share row exclusive mode;

truncate public.campaign_finance_totals;

insert into public.campaign_finance_totals (
  campaign_id, contribution_count, total, self_funded, outside
)
select
  campaign_id,
  count(*)::bigint,
  coalesce(sum(amount), 0),
  coalesce(sum(amount) filter (where is_self_funding), 0),
  coalesce(sum(amount) filter (where not is_self_funding), 0)
from public.contributions
group by campaign_id;

create or replace function public.adjust_campaign_finance_totals(
  p_campaign_id uuid,
  p_count_delta integer,
  p_total_delta numeric,
  p_self_delta numeric,
  p_outside_delta numeric
)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into public.campaign_finance_totals (
    campaign_id, contribution_count, total, self_funded, outside
  )
  values (
    p_campaign_id, p_count_delta, p_total_delta, p_self_delta, p_outside_delta
  )
  on conflict (campaign_id) do update set
    contribution_count = public.campaign_finance_totals.contribution_count + excluded.contribution_count,
    total = public.campaign_finance_totals.total + excluded.total,
    self_funded = public.campaign_finance_totals.self_funded + excluded.self_funded,
    outside = public.campaign_finance_totals.outside + excluded.outside;
$$;

create or replace function public.maintain_campaign_finance_totals()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  old_amount numeric;
  new_amount numeric;
begin
  if tg_op in ('DELETE', 'UPDATE') then
    old_amount := coalesce(old.amount, 0);
    perform public.adjust_campaign_finance_totals(
      old.campaign_id,
      -1,
      -old_amount,
      case when old.is_self_funding is true then -old_amount else 0 end,
      case when old.is_self_funding is false then -old_amount else 0 end
    );
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    new_amount := coalesce(new.amount, 0);
    perform public.adjust_campaign_finance_totals(
      new.campaign_id,
      1,
      new_amount,
      case when new.is_self_funding is true then new_amount else 0 end,
      case when new.is_self_funding is false then new_amount else 0 end
    );
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists contributions_finance_totals_trigger on public.contributions;
create trigger contributions_finance_totals_trigger
after insert or delete or update of campaign_id, amount, is_self_funding on public.contributions
for each row execute function public.maintain_campaign_finance_totals();

create or replace view public.campaign_finance as
select
  c.id as campaign_id,
  c.official_id,
  c.election_id,
  c.fl_doe_account,
  c.office_as_filed,
  c.district_as_filed,
  c.party_as_filed,
  c.source as campaign_source,
  coalesce(t.contribution_count, 0)::integer as contribution_count,
  coalesce(t.total, 0)::numeric(14,2) as total,
  coalesce(t.self_funded, 0)::numeric(14,2) as self_funded,
  coalesce(t.outside, 0)::numeric(14,2) as outside
from public.campaigns c
left join public.campaign_finance_totals t on t.campaign_id = c.id;

revoke all on function public.adjust_campaign_finance_totals(uuid, integer, numeric, numeric, numeric) from public;
revoke all on function public.maintain_campaign_finance_totals() from public;
grant select on public.campaign_finance to anon, authenticated;

notify pgrst, 'reload schema';
