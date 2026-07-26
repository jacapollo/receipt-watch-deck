import { createFileRoute, Link } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Landmark,
  Search,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import {
  OfficeTag,
  OfficialAvatar,
  PartyDot,
  SectionHeader,
  SourceTag,
  StatTile,
} from "@/components/polysnitch/Primitives";
import {
  electionLabel,
  fetchOfficialsIndex,
  fmtMoney,
  officialSlug,
  toPartyCode,
  type CampaignFinanceRow,
} from "@/lib/records";
import { supabase, supabaseConfigured } from "@/lib/supabase";

export const Route = createFileRoute("/money")({
  head: () => ({
    meta: [
      { title: "Money · PolySnitch" },
      {
        name: "description",
        content: "Campaign money, straight from the filings — outside donors vs self-funding.",
      },
    ],
  }),
  component: MoneyPage,
});

type Board = "outside" | "self";
type MoneyMode = "leaderboard" | "donors";
type MoneyFilters = { party: string; office: string; election: string };
type PageResult<T> = { rows: T[]; total: number };

type MoneyFacetRow = {
  party_as_filed: string | null;
  office_as_filed: string | null;
  election_id: string | null;
};

// Contribution rows carry only the campaign columns we actually render (source
// is used for the receipt link; office/party/district for the row context).
type CampaignEmbed = {
  id: string;
  official_id: string;
  election_id: string;
  party_as_filed: string | null;
  office_as_filed: string | null;
  district_as_filed: string | null;
  source: { label?: string; url?: string } | null;
};

type ContributionRow = {
  id: string;
  donor_name: string;
  amount: number;
  contribution_date: string | null;
  is_self_funding: boolean;
  source: { label?: string; url?: string } | null;
  campaigns: CampaignEmbed;
};

type MoneyFacets = {
  parties: Array<{ id: string; label: string }>;
  offices: string[];
  elections: string[];
  campaignCount: number;
};

type RosterEntry = {
  ocd_person_id: string;
  full_name: string;
  party: string | null;
  chamber: string | null;
  district: string | null;
};

const PAGE_SIZE = 25;
const DONOR_DEBOUNCE_MS = 300;
const DONOR_MIN_CHARS = 2;
const DONOR_MAX_CHARS = 100;

const FINANCE_SELECT =
  "campaign_id, official_id, election_id, fl_doe_account, office_as_filed, district_as_filed, party_as_filed, campaign_source, contribution_count, total, self_funded, outside";
const CONTRIBUTION_SELECT =
  "id, donor_name, amount, contribution_date, is_self_funding, source, campaigns!inner(id, official_id, election_id, party_as_filed, office_as_filed, district_as_filed, source)";

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

// The raw filings ship both terse codes ("REP") and legal names ("REPUBLICAN
// PARTY") for the same party. Fold them onto a single canonical option so the
// dropdown doesn't show duplicates; partyValues() expands the choice back to
// every raw string before it hits the server.
function canonicalParty(raw: string): { id: string; label: string } {
  const normalized = raw.trim().toUpperCase();
  if (normalized === "REP" || normalized === "REPUBLICAN PARTY")
    return { id: "REP", label: "Republican" };
  if (normalized === "DEM" || normalized === "DEMOCRATIC PARTY")
    return { id: "DEM", label: "Democratic" };
  return { id: raw, label: raw };
}

function partyValues(id: string): string[] {
  if (id === "REP") return ["REP", "REPUBLICAN PARTY"];
  if (id === "DEM") return ["DEM", "DEMOCRATIC PARTY"];
  return [id];
}

function toNumber(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function stampOf(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function hostOf(url?: string | null): string {
  if (!url) return "source";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "source";
  }
}

// Only the columns needed to populate filter dropdowns — no monetary fields,
// so this projection can't accidentally seed a page-scoped "total" that would
// mislead. Row count doubles as the tracked-campaign count for the top strip.
async function fetchMoneyFacets(): Promise<MoneyFacets> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase
    .from("campaign_finance")
    .select("party_as_filed, office_as_filed, election_id");
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as MoneyFacetRow[];
  const partyMap = new Map<string, { id: string; label: string }>();
  const offices = new Set<string>();
  const elections = new Set<string>();

  for (const row of rows) {
    if (row.party_as_filed) {
      const party = canonicalParty(row.party_as_filed);
      partyMap.set(party.id, party);
    }
    if (row.office_as_filed) offices.add(row.office_as_filed);
    if (row.election_id) elections.add(row.election_id);
  }

  const collator = new Intl.Collator("en", { sensitivity: "base" });
  return {
    parties: [...partyMap.values()].sort((a, b) => collator.compare(a.label, b.label)),
    offices: [...offices].sort(collator.compare),
    elections: [...elections].sort((a, b) => b.localeCompare(a)),
    campaignCount: rows.length,
  };
}

async function fetchLeaderboardPage(
  page: number,
  board: Board,
  filters: MoneyFilters,
): Promise<PageResult<CampaignFinanceRow>> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const from = page * PAGE_SIZE;
  let query = supabase.from("campaign_finance").select(FINANCE_SELECT, { count: "exact" });

  if (filters.party) query = query.in("party_as_filed", partyValues(filters.party));
  if (filters.office) query = query.eq("office_as_filed", filters.office);
  if (filters.election) query = query.eq("election_id", filters.election);

  const sortColumn = board === "outside" ? "outside" : "self_funded";
  const { data, count, error } = await query
    .order(sortColumn, { ascending: false })
    .order("campaign_id", { ascending: true })
    .range(from, from + PAGE_SIZE - 1);

  if (error) throw new Error(error.message);
  const rows = ((data ?? []) as unknown as CampaignFinanceRow[]).map((row) => ({
    ...row,
    contribution_count: toNumber(row.contribution_count),
    total: toNumber(row.total),
    self_funded: toNumber(row.self_funded),
    outside: toNumber(row.outside),
  }));
  return { rows, total: count ?? 0 };
}

async function fetchDonorPage(
  page: number,
  donorSearch: string,
  filters: MoneyFilters,
): Promise<PageResult<ContributionRow>> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const from = page * PAGE_SIZE;

  // supabase-js v2 accepts dotted foreign-column predicates directly on .eq /
  // .in — no `referencedTable` third arg (that only exists on .or). The count
  // query always uses !inner to mirror the row query's implicit inner join, so
  // the counted set matches the returned rows even when no campaign filter is
  // active.
  let rowsQuery = supabase
    .from("contributions")
    .select(CONTRIBUTION_SELECT)
    .ilike("donor_name", `%${donorSearch}%`);
  let countQuery = supabase
    .from("contributions")
    .select("id, campaigns!inner(id)", {
      count: "exact",
      head: true,
    })
    .ilike("donor_name", `%${donorSearch}%`);

  if (filters.party) {
    const values = partyValues(filters.party);
    rowsQuery = rowsQuery.in("campaigns.party_as_filed", values);
    countQuery = countQuery.in("campaigns.party_as_filed", values);
  }
  if (filters.office) {
    rowsQuery = rowsQuery.eq("campaigns.office_as_filed", filters.office);
    countQuery = countQuery.eq("campaigns.office_as_filed", filters.office);
  }
  if (filters.election) {
    rowsQuery = rowsQuery.eq("campaigns.election_id", filters.election);
    countQuery = countQuery.eq("campaigns.election_id", filters.election);
  }

  const [rowsResult, countResult] = await Promise.all([
    rowsQuery
      .order("contribution_date", { ascending: false, nullsFirst: false })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1),
    countQuery,
  ]);

  if (rowsResult.error) throw new Error(rowsResult.error.message);
  if (countResult.error) throw new Error(countResult.error.message);
  const rows = ((rowsResult.data ?? []) as unknown as ContributionRow[]).map((row) => ({
    ...row,
    amount: toNumber(row.amount),
  }));
  return { rows, total: countResult.count ?? 0 };
}

const MODE_COPY: Record<MoneyMode, { label: string; hint: string; countLabel: string }> = {
  leaderboard: {
    label: "Leaderboard",
    hint: "Aggregate campaign totals — every filed campaign, ranked by outside donations or self-funding.",
    countLabel: "CAMPAIGNS",
  },
  donors: {
    label: "Donor Search",
    hint: "Individual contribution records — search a donor's name to see every filed receipt they appear on.",
    countLabel: "CONTRIBUTIONS",
  },
};

function MoneyPage() {
  const [mode, setMode] = useState<MoneyMode>("leaderboard");
  const [board, setBoard] = useState<Board>("outside");
  const [page, setPage] = useState(0);
  const [party, setParty] = useState("");
  const [office, setOffice] = useState("");
  const [election, setElection] = useState("");
  const [donorInput, setDonorInput] = useState("");
  const donorSearch = useDebouncedValue(
    donorInput.trim().slice(0, DONOR_MAX_CHARS),
    DONOR_DEBOUNCE_MS,
  );
  const donorError = /[%_\\]/.test(donorInput)
    ? "Donor search cannot contain percent signs, underscores, or backslashes."
    : null;
  const filters: MoneyFilters = { party, office, election };
  const donorReady = donorSearch.length >= DONOR_MIN_CHARS && !donorError;

  const facetsQuery = useQuery({
    queryKey: ["money", "facets"],
    queryFn: fetchMoneyFacets,
    enabled: supabaseConfigured,
    staleTime: 5 * 60_000,
  });
  const rosterQuery = useQuery({
    queryKey: ["officials-index"],
    queryFn: fetchOfficialsIndex,
    enabled: supabaseConfigured,
    staleTime: 5 * 60_000,
  });
  const leaderboardQuery = useQuery({
    queryKey: ["money", "leaderboard", page, board, party, office, election],
    queryFn: () => fetchLeaderboardPage(page, board, filters),
    enabled: supabaseConfigured && mode === "leaderboard",
    placeholderData: keepPreviousData,
  });
  const donorQuery = useQuery({
    queryKey: ["money", "donors", page, donorSearch, party, office, election],
    queryFn: () => fetchDonorPage(page, donorSearch, filters),
    enabled: supabaseConfigured && mode === "donors" && donorReady,
    placeholderData: keepPreviousData,
  });

  const roster = useMemo<Map<string, RosterEntry>>(
    () => new Map((rosterQuery.data ?? []).map((official) => [official.ocd_person_id, official])),
    [rosterQuery.data],
  );
  const activeQuery = mode === "leaderboard" ? leaderboardQuery : donorQuery;
  const total = activeQuery.data?.total ?? 0;
  const maxPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);
  const displayPage = Math.min(page, maxPage);

  useEffect(() => {
    if (page > maxPage && !activeQuery.isPlaceholderData) setPage(maxPage);
  }, [activeQuery.isPlaceholderData, maxPage, page]);

  const update = <T,>(setter: (value: T) => void, value: T) => {
    setter(value);
    setPage(0);
  };

  const queryError = facetsQuery.error ?? activeQuery.error;
  const loading = facetsQuery.isLoading || activeQuery.isLoading;
  const modeCopy = MODE_COPY[mode];
  const countLabel =
    mode === "donors" && !donorReady
      ? "ENTER A DONOR"
      : activeQuery.data
        ? `${total.toLocaleString()} ${modeCopy.countLabel}`
        : "COUNTING…";

  return (
    <AppShell>
      <div className="px-4 md:px-8 py-6 md:py-8 max-w-[1400px] mx-auto">
        <SectionHeader
          eyebrow="CAMPAIGN FINANCE // RECEIPTS"
          title="Money"
          right={
            <span className="mono-label hidden md:inline">
              {facetsQuery.data
                ? `${facetsQuery.data.campaignCount.toLocaleString()} CAMPAIGNS TRACKED`
                : "LOADING…"}
            </span>
          }
        />

        {!supabaseConfigured ? (
          <ConfigureNotice />
        ) : queryError ? (
          <ErrorNotice message={(queryError as Error).message} />
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <StatTile
                label="CAMPAIGNS TRACKED"
                value={facetsQuery.data ? facetsQuery.data.campaignCount.toLocaleString() : "—"}
                icon={Landmark}
                tone="amber"
                sub="per official, per cycle"
              />
              <StatTile
                label="OFFICIALS ON RECORD"
                value={rosterQuery.data ? rosterQuery.data.length.toLocaleString() : "—"}
                icon={Users}
                tone="cyan"
                sub="joined via campaign filings"
              />
              <StatTile
                label="ELECTION CYCLES"
                value={facetsQuery.data ? facetsQuery.data.elections.length.toLocaleString() : "—"}
                icon={CalendarDays}
                tone="yellow"
                sub="available as filters"
              />
              <StatTile
                label="OFFICES"
                value={facetsQuery.data ? facetsQuery.data.offices.length.toLocaleString() : "—"}
                icon={Building2}
                sub="distinct offices filed"
              />
            </div>

            <div
              role="tablist"
              aria-label="Money view mode"
              className="border-2 border-amber/60 bg-surface rounded-sm p-3 md:p-4 mb-4"
            >
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex border border-border bg-background rounded-sm overflow-hidden">
                  {(Object.keys(MODE_COPY) as MoneyMode[]).map((id) => (
                    <button
                      key={id}
                      role="tab"
                      aria-selected={mode === id}
                      onClick={() => update(setMode, id)}
                      className={`px-5 py-2.5 font-mono text-xs uppercase tracking-widest transition ${mode === id ? "bg-amber text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-surface-2"}`}
                    >
                      {MODE_COPY[id].label}
                    </button>
                  ))}
                </div>
                <span className="mono-label md:ml-auto text-amber">{countLabel}</span>
              </div>
              <p className="mt-3 text-xs text-muted-foreground max-w-2xl">{modeCopy.hint}</p>
            </div>

            <div className="border border-border bg-surface rounded-sm p-3 md:p-4 mb-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <FilterSelect
                  label="Party"
                  value={party}
                  onChange={(value) => update(setParty, value)}
                >
                  <option value="">All parties</option>
                  {(facetsQuery.data?.parties ?? []).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </FilterSelect>
                <FilterSelect
                  label="Office"
                  value={office}
                  onChange={(value) => update(setOffice, value)}
                >
                  <option value="">All offices</option>
                  {(facetsQuery.data?.offices ?? []).map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </FilterSelect>
                <FilterSelect
                  label="Election cycle"
                  value={election}
                  onChange={(value) => update(setElection, value)}
                >
                  <option value="">All cycles</option>
                  {(facetsQuery.data?.elections ?? []).map((item) => (
                    <option key={item} value={item}>
                      {electionLabel(item) === item ? item : `${electionLabel(item)} · ${item}`}
                    </option>
                  ))}
                </FilterSelect>
              </div>

              {mode === "leaderboard" ? (
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="mono-label mr-1">SORT</span>
                  <div
                    role="tablist"
                    aria-label="Leaderboard sort"
                    className="flex border border-border bg-background rounded-sm overflow-hidden"
                  >
                    {(
                      [
                        ["outside", "Top outside money"],
                        ["self", "Top self-funders"],
                      ] as [Board, string][]
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        role="tab"
                        aria-selected={board === id}
                        onClick={() => update(setBoard, id)}
                        className={`px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest transition ${board === id ? "bg-amber text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-surface-2"}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <label className="block space-y-1">
                  <span className="mono-label">DONOR NAME</span>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="search"
                      value={donorInput}
                      maxLength={DONOR_MAX_CHARS}
                      aria-invalid={!!donorError}
                      onChange={(event) => update(setDonorInput, event.target.value)}
                      placeholder="Search individual, PAC, or organization"
                      className={`w-full h-9 border bg-background rounded-sm pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none ${donorError ? "border-status-red" : "border-border focus:border-amber"}`}
                    />
                  </div>
                  {donorError ? (
                    <span className="block font-mono text-[11px] text-status-red">
                      {donorError}
                    </span>
                  ) : donorInput.trim().length === 1 ? (
                    <span className="block font-mono text-[11px] text-muted-foreground">
                      Enter at least {DONOR_MIN_CHARS} characters.
                    </span>
                  ) : null}
                </label>
              )}
            </div>

            {loading ? (
              <ListSkeleton />
            ) : mode === "donors" && donorError ? (
              <EmptyRow body="Correct the donor search to run this query." />
            ) : mode === "donors" && !donorReady ? (
              <EmptyRow body="Enter at least two characters above to search individual contribution records — no query runs until you do." />
            ) : mode === "leaderboard" ? (
              leaderboardQuery.data?.rows.length ? (
                <ul className="divide-y divide-border border border-border rounded-sm bg-surface">
                  {leaderboardQuery.data.rows.map((campaign, index) => (
                    <LeaderRow
                      key={campaign.campaign_id}
                      rank={page * PAGE_SIZE + index + 1}
                      campaign={campaign}
                      board={board}
                      official={roster.get(campaign.official_id)}
                    />
                  ))}
                </ul>
              ) : (
                <EmptyRow body="No campaigns match these filters." />
              )
            ) : donorQuery.data?.rows.length ? (
              <ul className="divide-y divide-border border border-border rounded-sm bg-surface">
                {donorQuery.data.rows.map((contribution) => (
                  <DonorRow
                    key={contribution.id}
                    contribution={contribution}
                    official={roster.get(contribution.campaigns.official_id)}
                  />
                ))}
              </ul>
            ) : (
              <EmptyRow body="No contributions match this donor and filter combination." />
            )}

            {(mode === "leaderboard" || donorReady) && (
              <div className="mt-6 flex items-center justify-between gap-3">
                <PageButton
                  dir="prev"
                  disabled={page === 0 || activeQuery.isFetching}
                  onClick={() => setPage((value) => Math.max(0, value - 1))}
                />
                <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                  PAGE {displayPage + 1} OF {maxPage + 1}
                  {activeQuery.isFetching && !activeQuery.isLoading ? " · loading…" : ""}
                </span>
                <PageButton
                  dir="next"
                  disabled={page >= maxPage || activeQuery.isFetching}
                  onClick={() => setPage((value) => Math.min(maxPage, value + 1))}
                />
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-1">
      <span className="mono-label">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full h-9 border border-border bg-background rounded-sm px-2 font-mono text-[11px] uppercase tracking-wider text-foreground"
      >
        {children}
      </select>
    </label>
  );
}

function LeaderRow({
  rank,
  campaign,
  board,
  official,
}: {
  rank: number;
  campaign: CampaignFinanceRow;
  board: Board;
  official?: RosterEntry;
}) {
  const amount = board === "outside" ? campaign.outside : campaign.self_funded;
  const party = toPartyCode(official?.party ?? campaign.party_as_filed);
  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      <span className="font-mono text-[11px] text-muted-foreground w-6 text-right shrink-0">
        {rank}
      </span>
      <OfficialAvatar
        official={{ name: official?.full_name ?? "?", photoSeed: campaign.official_id, party }}
        size={32}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            to="/officials/$id"
            params={{ id: officialSlug(campaign.official_id) }}
            className="text-sm font-medium hover:text-amber truncate"
          >
            {official?.full_name ?? campaign.official_id}
          </Link>
          <PartyDot party={party} />
          <OfficeTag
            level="state"
            text={
              campaign.office_as_filed ?? (official?.district ? `Dist ${official.district}` : "—")
            }
          />
        </div>
        <div className="mono-label">
          {electionLabel(campaign.election_id)} · {campaign.contribution_count.toLocaleString()}{" "}
          contributions
        </div>
      </div>
      <div className="text-right shrink-0">
        <div
          className={`font-mono font-bold tabular-nums ${board === "self" ? "text-status-yellow" : "text-cyan"}`}
        >
          {fmtMoney(amount)}
        </div>
        <div className="mono-label">
          {board === "outside"
            ? `+${fmtMoney(campaign.self_funded)} self`
            : `+${fmtMoney(campaign.outside)} outside`}
        </div>
      </div>
    </li>
  );
}

function DonorRow({
  contribution,
  official,
}: {
  contribution: ContributionRow;
  official?: RosterEntry;
}) {
  const campaign = contribution.campaigns;
  const party = toPartyCode(official?.party ?? campaign.party_as_filed);
  const amountTone = contribution.is_self_funding ? "text-status-yellow" : "text-cyan";
  return (
    <li className="flex items-start gap-3 px-3 py-3">
      <OfficialAvatar
        official={{ name: official?.full_name ?? "?", photoSeed: campaign.official_id, party }}
        size={32}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-foreground">{contribution.donor_name}</span>
          {contribution.is_self_funding && (
            <span className="font-mono text-[10px] uppercase tracking-widest border border-status-yellow/50 bg-status-yellow/10 text-status-yellow px-1.5 py-0.5 rounded-[2px]">
              Self-funded
            </span>
          )}
        </div>
        <div className="mt-1 flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
          <span>to</span>
          <Link
            to="/officials/$id"
            params={{ id: officialSlug(campaign.official_id) }}
            className="text-cyan hover:text-amber"
          >
            {official?.full_name ?? campaign.official_id}
          </Link>
          <PartyDot party={party} />
          <OfficeTag
            level="state"
            text={
              campaign.office_as_filed ??
              (campaign.district_as_filed ? `Dist ${campaign.district_as_filed}` : "—")
            }
          />
          <span className="font-mono">{electionLabel(campaign.election_id)}</span>
        </div>
        {contribution.source?.url && (
          <div className="mt-2">
            <SourceTag source={hostOf(contribution.source.url)} url={contribution.source.url} />
          </div>
        )}
      </div>
      <div className="text-right shrink-0">
        <div className={`font-mono font-bold tabular-nums ${amountTone}`}>
          {fmtMoney(contribution.amount)}
        </div>
        <div className="mono-label">{stampOf(contribution.contribution_date)}</div>
      </div>
    </li>
  );
}

function PageButton({
  dir,
  disabled,
  onClick,
}: {
  dir: "prev" | "next";
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = dir === "prev" ? ChevronLeft : ChevronRight;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === "prev" ? "Previous page" : "Next page"}
      className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest px-3 py-2 border border-border rounded-sm text-foreground transition hover:border-amber hover:text-amber disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-foreground"
    >
      {dir === "prev" && <Icon className="h-3.5 w-3.5" />}
      {dir === "prev" ? "Prev" : "Next"}
      {dir === "next" && <Icon className="h-3.5 w-3.5" />}
    </button>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="h-14 bg-surface-2 animate-pulse rounded-sm" />
      ))}
    </div>
  );
}

function EmptyRow({ body }: { body: string }) {
  return (
    <div className="border border-dashed border-border rounded-sm p-5 text-center">
      <p className="text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

function ErrorNotice({ message }: { message: string }) {
  return (
    <div className="border border-status-red/50 bg-status-red/5 rounded-sm p-6">
      <div className="mono-label text-status-red">QUERY_FAULT</div>
      <p className="mt-1 font-mono text-[11px] text-muted-foreground break-all">{message}</p>
    </div>
  );
}

function ConfigureNotice() {
  return (
    <div className="border border-border bg-surface rounded-sm p-6">
      <div className="mono-label text-amber">SUPABASE // NOT_CONFIGURED</div>
      <p className="mt-2 text-sm text-foreground">
        Add credentials to <span className="font-mono text-cyan">.env.local</span> and restart.
      </p>
    </div>
  );
}
