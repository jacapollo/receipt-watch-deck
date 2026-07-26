import { createFileRoute, Link } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { officialSlug } from "@/lib/records";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Gavel } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import {
  OfficeTag,
  OfficialAvatar,
  PartyDot,
  SectionHeader,
  SourceTag,
  StatTile,
} from "@/components/polysnitch/Primitives";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import type { Party } from "@/lib/mock-data";

export const Route = createFileRoute("/votes")({
  head: () => ({
    meta: [
      { title: "Votes · PolySnitch" },
      { name: "description", content: "Real roll-call votes, straight from the public record." },
    ],
  }),
  component: VotesPage,
});

type VoteRow = {
  individual_vote_id: string;
  option: string;
  motion_text: string | null;
  vote_result: string | null;
  vote_date: string | null;
  chamber: string | null;
  source: { label?: string; url?: string } | null;
  officials: {
    ocd_person_id: string;
    full_name: string;
    party: string | null;
    office: string | null;
    district: string | null;
  } | null;
  bills: {
    id: string;
    identifier: string;
    title: string;
    openstates_url: string | null;
  } | null;
};

type VotesPageResult = { rows: VoteRow[]; total: number };

const PAGE_SIZE = 25;
const SEARCH_LIMIT = 100;

const OPTION_FILTERS = [
  { id: "all", label: "All" },
  { id: "yes", label: "Yea" },
  { id: "no", label: "Nay" },
  { id: "not voting", label: "N/V" },
  { id: "excused", label: "Excused" },
] as const;

const CHAMBER_FILTERS = [
  { id: "all", label: "All chambers" },
  { id: "lower", label: "House" },
  { id: "upper", label: "Senate" },
] as const;

type OptionFilter = (typeof OPTION_FILTERS)[number]["id"];
type ChamberFilter = (typeof CHAMBER_FILTERS)[number]["id"];

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function validateSearchSyntax(value: string): string | null {
  if (/[%_(),:\\]/.test(value)) {
    return "Use letters, numbers, spaces, periods, slashes, or hyphens only.";
  }
  return null;
}

function toPartyCode(party?: string | null): Party {
  const p = (party || "").toLowerCase();
  if (p.startsWith("dem")) return "D";
  if (p.startsWith("rep")) return "R";
  return "I";
}

function optionDisplay(option: string): { label: string; cls: string } {
  switch ((option || "").toLowerCase()) {
    case "yes":
      return { label: "YEA", cls: "text-status-green border-status-green/50 bg-status-green/10" };
    case "no":
      return { label: "NAY", cls: "text-status-red border-status-red/50 bg-status-red/10" };
    case "not voting":
      return { label: "N/V", cls: "text-muted-foreground border-border" };
    case "excused":
      return {
        label: "EXCUSED",
        cls: "text-status-yellow border-status-yellow/50 bg-status-yellow/10",
      };
    default:
      return { label: option.toUpperCase(), cls: "text-cyan border-cyan/50 bg-cyan/10" };
  }
}

function hostOf(url?: string | null): string {
  if (!url) return "source";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "source";
  }
}

function toNumber(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function stampOf(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function voteSelect(officialSearch: string, billSearch: string): string {
  const officials = `officials${officialSearch ? "!inner" : ""}(ocd_person_id, full_name, party, office, district)`;
  const bills = `bills${billSearch ? "!inner" : ""}(id, identifier, title, openstates_url)`;
  return `individual_vote_id, option, motion_text, vote_result, vote_date, chamber, source, ${officials}, ${bills}`;
}

async function fetchVotesPage(args: {
  page: number;
  option: OptionFilter;
  chamber: ChamberFilter;
  officialSearch: string;
  billSearch: string;
}): Promise<VotesPageResult> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { page, option, chamber, officialSearch, billSearch } = args;
  const from = page * PAGE_SIZE;

  let query = supabase.from("votes").select(voteSelect(officialSearch, billSearch));

  if (option !== "all") query = query.eq("option", option);
  if (chamber !== "all") query = query.eq("chamber", chamber);
  if (officialSearch) query = query.ilike("officials.full_name", `%${officialSearch}%`);
  if (billSearch) {
    query = query.or(`identifier.ilike.%${billSearch}%,title.ilike.%${billSearch}%`, {
      referencedTable: "bills",
    });
  }

  const rowsPromise = query
    .order("vote_date", { ascending: false, nullsFirst: false })
    .range(from, from + PAGE_SIZE - 1);
  const countPromise = supabase.rpc("count_votes_filtered", {
    p_option: option === "all" ? null : option,
    p_chamber: chamber === "all" ? null : chamber,
    p_official_search: officialSearch || null,
    p_bill_search: billSearch || null,
  });

  const [rowsResult, countResult] = await Promise.all([rowsPromise, countPromise]);
  if (rowsResult.error) throw new Error(rowsResult.error.message);
  if (countResult.error) throw new Error(countResult.error.message);
  return {
    rows: (rowsResult.data ?? []) as unknown as VoteRow[],
    total: toNumber(countResult.data),
  };
}

async function fetchEstimatedCount(table: string): Promise<number> {
  if (!supabase) return 0;
  const { count } = await supabase.from(table).select("*", { count: "estimated", head: true });
  return count ?? 0;
}

function VotesPage() {
  const [page, setPage] = useState(0);
  const [option, setOption] = useState<OptionFilter>("all");
  const [chamber, setChamber] = useState<ChamberFilter>("all");
  const [officialInput, setOfficialInput] = useState("");
  const [billInput, setBillInput] = useState("");
  const debouncedOfficial = useDebouncedValue(officialInput.trim().slice(0, SEARCH_LIMIT), 300);
  const debouncedBill = useDebouncedValue(billInput.trim().slice(0, SEARCH_LIMIT), 300);
  const officialError = validateSearchSyntax(officialInput.trim());
  const billError = validateSearchSyntax(billInput.trim());
  const officialSearch = officialError ? "" : debouncedOfficial;
  const billSearch = billError ? "" : debouncedBill;

  const votesQuery = useQuery({
    queryKey: ["votes", page, option, chamber, officialSearch, billSearch],
    queryFn: () => fetchVotesPage({ page, option, chamber, officialSearch, billSearch }),
    enabled: supabaseConfigured && !officialError && !billError,
    placeholderData: keepPreviousData,
  });

  const countsQuery = useQuery({
    queryKey: ["record-counts"],
    queryFn: async () => ({
      votes: await fetchEstimatedCount("votes"),
      officials: await fetchEstimatedCount("officials"),
      bills: await fetchEstimatedCount("bills"),
    }),
    enabled: supabaseConfigured,
    staleTime: Infinity,
  });

  const rows = votesQuery.data?.rows ?? [];
  const total = votesQuery.data?.total ?? 0;
  const maxPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);
  const displayPage = Math.min(page, maxPage);

  useEffect(() => {
    if (page > maxPage && !votesQuery.isPlaceholderData) setPage(maxPage);
  }, [maxPage, page, votesQuery.isPlaceholderData]);

  const setFilter = <T,>(setter: (value: T) => void, value: T) => {
    setter(value);
    setPage(0);
  };

  return (
    <AppShell>
      <div className="px-4 md:px-8 py-6 md:py-8 max-w-[1400px] mx-auto">
        <SectionHeader
          eyebrow="ROLL CALL // LIVE RECORD"
          title="Votes"
          right={
            <span className="mono-label hidden md:inline">
              {countsQuery.data
                ? `${countsQuery.data.votes.toLocaleString()} ON RECORD`
                : "LOADING…"}
            </span>
          }
        />

        {!supabaseConfigured ? (
          <ConfigureNotice />
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
              <StatTile
                label="VOTES ON RECORD"
                value={countsQuery.data ? countsQuery.data.votes.toLocaleString() : "—"}
                sub="individual roll-call votes"
                icon={Gavel}
                tone="amber"
              />
              <StatTile
                label="OFFICIALS"
                value={countsQuery.data ? countsQuery.data.officials.toLocaleString() : "—"}
                sub="in the roster"
                tone="cyan"
              />
              <StatTile
                label="BILLS"
                value={countsQuery.data ? countsQuery.data.bills.toLocaleString() : "—"}
                sub="tracked"
                tone="default"
              />
            </div>

            <div className="border border-border bg-surface rounded-sm p-3 md:p-4 mb-5 space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="mono-label mr-1">FILTER</span>
                <select
                  aria-label="Chamber"
                  value={chamber}
                  onChange={(event) => setFilter(setChamber, event.target.value as ChamberFilter)}
                  className="h-8 border border-border bg-background rounded-sm px-2 font-mono text-[11px] uppercase tracking-wider text-foreground"
                >
                  {CHAMBER_FILTERS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <div
                  role="group"
                  aria-label="Vote option"
                  className="flex border border-border bg-background rounded-sm overflow-hidden"
                >
                  {OPTION_FILTERS.map((item) => (
                    <button
                      key={item.id}
                      aria-pressed={option === item.id}
                      onClick={() => setFilter(setOption, item.id)}
                      className={`px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest transition ${option === item.id ? "bg-amber text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-surface-2"}`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <span className="mono-label md:ml-auto text-amber">
                  {votesQuery.data ? `${total.toLocaleString()} VOTES` : "COUNTING…"}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="mono-label">OFFICIAL</span>
                  <input
                    type="search"
                    value={officialInput}
                    maxLength={SEARCH_LIMIT}
                    aria-invalid={!!officialError}
                    onChange={(event) => setFilter(setOfficialInput, event.target.value)}
                    placeholder="Search official name"
                    className={`w-full h-9 border bg-background rounded-sm px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none ${officialError ? "border-status-red" : "border-border focus:border-amber"}`}
                  />
                  {officialError && (
                    <span className="block font-mono text-[11px] text-status-red">
                      {officialError}
                    </span>
                  )}
                </label>
                <label className="space-y-1">
                  <span className="mono-label">BILL</span>
                  <input
                    type="search"
                    value={billInput}
                    maxLength={SEARCH_LIMIT}
                    aria-invalid={!!billError}
                    onChange={(event) => setFilter(setBillInput, event.target.value)}
                    placeholder="Search identifier or title"
                    className={`w-full h-9 border bg-background rounded-sm px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none ${billError ? "border-status-red" : "border-border focus:border-amber"}`}
                  />
                  {billError && (
                    <span className="block font-mono text-[11px] text-status-red">{billError}</span>
                  )}
                </label>
              </div>
            </div>

            {votesQuery.isError ? (
              <ErrorNotice message={(votesQuery.error as Error).message} />
            ) : votesQuery.isLoading ? (
              <ListSkeleton />
            ) : officialError || billError ? (
              <EmptyRow body="Correct the search input to run this query." />
            ) : rows.length === 0 ? (
              <EmptyRow body="No votes match these filters." />
            ) : (
              <div className="space-y-3">
                {rows.map((vote) => (
                  <VoteCard key={vote.individual_vote_id} vote={vote} />
                ))}
              </div>
            )}

            <div className="mt-6 flex items-center justify-between gap-3">
              <PageButton
                dir="prev"
                disabled={page === 0 || votesQuery.isFetching}
                onClick={() => setPage((value) => Math.max(0, value - 1))}
              />
              <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                PAGE {displayPage + 1} OF {maxPage + 1}
                {votesQuery.isFetching && !votesQuery.isLoading ? " · loading…" : ""}
              </span>
              <PageButton
                dir="next"
                disabled={page >= maxPage || votesQuery.isFetching}
                onClick={() => setPage((value) => Math.min(maxPage, value + 1))}
              />
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

function VoteCard({ vote }: { vote: VoteRow }) {
  const official = vote.officials;
  const bill = vote.bills;
  const display = optionDisplay(vote.option);
  const party = toPartyCode(official?.party);

  return (
    <article className="group border border-border bg-surface hover:border-amber/40 hover:bg-surface-2/60 transition rounded-sm p-4 md:p-5">
      <div className="flex items-start gap-3">
        <OfficialAvatar
          official={{
            name: official?.full_name ?? "Unknown",
            photoSeed: official?.ocd_person_id ?? "",
            party,
          }}
          size={44}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
            {official ? (
              <Link
                to="/officials/$id"
                params={{ id: officialSlug(official.ocd_person_id) }}
                className="font-semibold text-foreground hover:text-amber truncate"
              >
                {official.full_name}
              </Link>
            ) : (
              <span className="font-semibold text-foreground truncate">Unknown official</span>
            )}
            <PartyDot party={party} />
            <OfficeTag
              level="state"
              text={
                official?.district
                  ? `FL · ${official.office ?? "—"} · Dist ${official.district}`
                  : (official?.office ?? "—")
              }
            />
          </div>
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center font-mono text-[11px] font-bold uppercase tracking-widest px-1.5 py-0.5 border rounded-[2px] ${display.cls}`}
            >
              {display.label}
            </span>
            <span className="font-mono text-[11px] text-muted-foreground tracking-wider">
              {stampOf(vote.vote_date)}
              {vote.motion_text ? ` · ${vote.motion_text}` : ""}
            </span>
          </div>
          {bill && (
            <p className="mt-2 text-sm text-foreground leading-snug">
              <span className="font-mono text-cyan font-semibold">{bill.identifier}</span>{" "}
              <span className="text-muted-foreground">— {bill.title}</span>
            </p>
          )}
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <SourceTag source={hostOf(vote.source?.url)} url={vote.source?.url ?? "#"} />
            {vote.vote_result && (
              <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground border border-border px-1.5 py-0.5 rounded-[2px]">
                RESULT · {vote.vote_result}
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
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
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="h-24 bg-surface-2 animate-pulse rounded-sm" />
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
      <p className="mt-2 text-sm text-foreground">Couldn't load votes from Supabase.</p>
      <p className="mt-1 font-mono text-[11px] text-muted-foreground break-all">{message}</p>
    </div>
  );
}

function ConfigureNotice() {
  return (
    <div className="border border-border bg-surface rounded-sm p-6">
      <div className="mono-label text-amber">SUPABASE // NOT_CONFIGURED</div>
      <p className="mt-2 text-sm text-foreground">
        The Votes lens reads live data from Supabase. Add your project credentials to{" "}
        <span className="font-mono text-cyan">.env.local</span> and restart the dev server:
      </p>
      <pre className="mt-3 text-[12px] font-mono bg-background border border-border rounded-sm p-3 overflow-x-auto text-muted-foreground">{`VITE_SUPABASE_URL=https://<your-project>.supabase.co\nVITE_SUPABASE_ANON_KEY=<your-anon-or-publishable-key>`}</pre>
    </div>
  );
}
