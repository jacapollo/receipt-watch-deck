-- Fix negative-delta maintenance. PostgreSQL validates CHECK constraints on an
-- attempted INSERT before ON CONFLICT applies its UPDATE, so an upsert whose
-- proposed count is -1 fails even when the existing row would remain positive.
-- Update existing summary rows first; only insert previously unseen positive
-- keys/campaigns.

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
  update public.vote_filter_counts
  set exact_count = exact_count + p_delta
  where chamber_key = '*' and option_key = '*';
  if not found then
    if p_delta < 0 then raise exception 'missing global vote count'; end if;
    insert into public.vote_filter_counts values ('*', '*', p_delta);
  end if;

  if p_chamber is not null then
    update public.vote_filter_counts
    set exact_count = exact_count + p_delta
    where chamber_key = p_chamber and option_key = '*';
    if not found then
      if p_delta < 0 then raise exception 'missing chamber vote count for %', p_chamber; end if;
      insert into public.vote_filter_counts values (p_chamber, '*', p_delta);
    end if;
  end if;

  if p_option is not null then
    update public.vote_filter_counts
    set exact_count = exact_count + p_delta
    where chamber_key = '*' and option_key = p_option;
    if not found then
      if p_delta < 0 then raise exception 'missing option vote count for %', p_option; end if;
      insert into public.vote_filter_counts values ('*', p_option, p_delta);
    end if;
  end if;

  if p_chamber is not null and p_option is not null then
    update public.vote_filter_counts
    set exact_count = exact_count + p_delta
    where chamber_key = p_chamber and option_key = p_option;
    if not found then
      if p_delta < 0 then
        raise exception 'missing chamber/option vote count for %/%', p_chamber, p_option;
      end if;
      insert into public.vote_filter_counts values (p_chamber, p_option, p_delta);
    end if;
  end if;
end;
$$;

create or replace function public.adjust_campaign_finance_totals(
  p_campaign_id uuid,
  p_count_delta integer,
  p_total_delta numeric,
  p_self_delta numeric,
  p_outside_delta numeric
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.campaign_finance_totals
  set
    contribution_count = contribution_count + p_count_delta,
    total = total + p_total_delta,
    self_funded = self_funded + p_self_delta,
    outside = outside + p_outside_delta
  where campaign_id = p_campaign_id;

  if not found then
    if p_count_delta < 0 then
      raise exception 'missing campaign finance total for %', p_campaign_id;
    end if;
    insert into public.campaign_finance_totals (
      campaign_id, contribution_count, total, self_funded, outside
    ) values (
      p_campaign_id, p_count_delta, p_total_delta, p_self_delta, p_outside_delta
    );
  end if;
end;
$$;

revoke all on function public.adjust_vote_filter_counts(text, text, integer) from public;
revoke all on function public.adjust_campaign_finance_totals(uuid, integer, numeric, numeric, numeric) from public;

notify pgrst, 'reload schema';
