import { createFileRoute, Link } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Gavel,
  FileText,
  Banknote,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Radio,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import {
  OfficeTag,
  OfficialAvatar,
  PartyDot,
  SectionHeader,
  SourceTag,
  BillStatusPill,
} from "@/components/polysnitch/Primitives";
import {
  electionLabel,
  fetchAllCampaignFinance,
  fetchEstimatedCount,
  fetchFeed,
  fetchOfficialsIndex,
  fmtMoney,
  hostOf,
  officialSlug,
  optionDisplay,
  relTime,
  stampOf,
  toPartyCode,
  type FeedContribution,
  type FeedBill,
  type FeedFilter,
  type FeedItem,
  type FeedVote,
  type OfficialRow,
} from "@/lib/records";
import { supabase, supabaseConfigured } from "@/lib/supabase";

export const Route = createFileRoute("/feed")({
  head: () => ({
    meta: [
      { title: "Feed · PolySnitch Watchfloor" },
      { name: "description", content: "Live merged stream of real votes, bills, and contributions — every item sourced." },
    ],
  }),
  component: FeedPage,
});

type RosterOfficial = Pick<OfficialRow, "ocd_person_id" | "full_name" | "party" | "chamber" | "district">;

const FILTERS: { id: FeedFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "vote", label: "Votes" },
  { id: "bill", label: "Bills" },
  { id: "contribution", label: "Money" },
];

function FeedPage() {
  const [filter, setFilter] = useState<FeedFilter>("all");
  const [page, setPage] = useState(0);

  const feedQuery = useQuery({
    queryKey: ["feed", filter, page],
    queryFn: () => fetchFeed(filter, page),
    enabled: supabaseConfigured,
    placeholderData: keepPreviousData,
  });

  // roster: resolve contribution recipients (official_id -> name/party/district)
  const rosterQuery = useQuery({
    queryKey: ["officials-index"],
    queryFn: fetchOfficialsIndex,
    enabled: supabaseConfigured,
    staleTime: 5 * 60_000,
  });
  const roster = useMemo(
    () => new Map((rosterQuery.data ?? []).map((o) => [o.ocd_person_id, o as RosterOfficial])),
    [rosterQuery.data],
  );

  const items = feedQuery.data?.items ?? [];
  const hasNext = feedQuery.data?.hasMore ?? false;

  return (
    <AppShell>
      <div className="px-4 md:px-8 py-6 md:py-8 max-w-[1600px] mx-auto">
        <SectionHeader
          eyebrow="WATCHFLOOR // LIVE RECORD"
          title="Feed"
          right={
            <span className="mono-label hidden md:inline flex items-center gap-2">
              <Radio className="h-3 w-3 text-status-green animate-pulse" />
              VOTES · BILLS · MONEY — MERGED
            </span>
          }
        />

        {!supabaseConfigured ? (
          <ConfigureNotice />
        ) : (
          <>
            {/* type filter — the balance lever so votes don't drown the rest */}
            <div className="flex items-center gap-3 flex-wrap mb-5">
              <span className="mono-label mr-1">STREAM</span>
              <div className="flex border border-border bg-surface rounded-sm overflow-hidden">
                {FILTERS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => {
                      setFilter(f.id);
                      setPage(0);
                    }}
                    className={`px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest transition ${
                      filter === f.id
                        ? "bg-amber text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-surface-2"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              {filter === "all" && (
                <span className="mono-label text-muted-foreground hidden lg:inline">
                  EQUAL SLICE PER TYPE · NEWEST FIRST
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
              <div className="space-y-3 min-w-0">
                {feedQuery.isError ? (
                  <ErrorNotice message={(feedQuery.error as Error).message} />
                ) : feedQuery.isLoading ? (
                  <SkeletonList />
                ) : items.length === 0 ? (
                  <EmptyNotice />
                ) : (
                  items.map((item) => <FeedRow key={item.key} item={item} roster={roster} />)
                )}

                <div className="mt-6 flex items-center justify-between gap-3">
                  <PageButton
                    dir="prev"
                    disabled={page === 0 || feedQuery.isFetching}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  />
                  <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                    PAGE {page + 1}
                    {feedQuery.isFetching && page > 0 ? " · loading…" : ""}
                  </span>
                  <PageButton
                    dir="next"
                    disabled={!hasNext || feedQuery.isFetching}
                    onClick={() => setPage((p) => p + 1)}
                  />
                </div>
              </div>

              <aside className="hidden lg:block space-y-6">
                <RecordCounts />
                <TopFunded roster={roster} />
              </aside>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

// ---- one row: dispatch on kind ---------------------------------------------

function FeedRow({ item, roster }: { item: FeedItem; roster: Map<string, RosterOfficial> }) {
  if (item.kind === "vote") return <VoteRow item={item} />;
  if (item.kind === "bill") return <BillRow item={item} />;
  return <ContribRow item={item} roster={roster} />;
}

// Shared frame so all three read as one stream but each carries a distinct
// colored kind-rail + icon so a vote/bill/donation is never a muddle.
function RowFrame({
  accent,
  icon: Icon,
  kind,
  time,
  children,
}: {
  accent: "amber" | "cyan" | "green";
  icon: React.ComponentType<{ className?: string }>;
  kind: string;
  time: string | null;
  children: React.ReactNode;
}) {
  const rail = accent === "amber" ? "border-l-amber" : accent === "cyan" ? "border-l-cyan" : "border-l-status-green";
  const tint = accent === "amber" ? "text-amber" : accent === "cyan" ? "text-cyan" : "text-status-green";
  return (
    <article className={`group border border-border ${rail} border-l-2 bg-surface hover:border-amber/40 hover:bg-surface-2/60 transition rounded-sm p-4 md:p-5`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-3.5 w-3.5 ${tint}`} />
        <span className={`font-mono text-[11px] font-bold uppercase tracking-widest ${tint}`}>{kind}</span>
        <span className="font-mono text-[11px] text-muted-foreground tracking-wider ml-auto" title={stampOf(time)}>
          {relTime(time)}
        </span>
      </div>
      {children}
    </article>
  );
}

function VoteRow({ item }: { item: FeedVote }) {
  const o = item.official;
  const b = item.bill;
  const opt = optionDisplay(item.option);
  const party = toPartyCode(o?.party);
  return (
    <RowFrame accent="amber" icon={Gavel} kind="Roll-call vote" time={item.date}>
      <div className="flex items-start gap-3">
        <OfficialAvatar official={{ name: o?.full_name ?? "Unknown", photoSeed: o?.ocd_person_id ?? "", party }} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
            {o ? (
              <Link to="/officials/$id" params={{ id: officialSlug(o.ocd_person_id) }} className="font-semibold hover:text-amber truncate">
                {o.full_name}
              </Link>
            ) : (
              <span className="font-semibold truncate">Unknown official</span>
            )}
            <PartyDot party={party} />
            <span className={`inline-flex items-center font-mono text-[11px] font-bold uppercase tracking-widest px-1.5 py-0.5 border rounded-[2px] ${opt.cls}`}>
              voted {opt.label}
            </span>
          </div>
          <p className="mt-1.5 text-sm leading-snug">
            {b ? (
              <>
                <span className="text-muted-foreground">on </span>
                {b.openstates_url ? (
                  <a href={b.openstates_url} target="_blank" rel="noopener noreferrer" className="font-mono text-cyan font-semibold hover:underline inline-flex items-center gap-1">
                    {b.identifier}
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                ) : (
                  <span className="font-mono text-cyan font-semibold">{b.identifier}</span>
                )}
                <span className="text-muted-foreground"> — {b.title}</span>
              </>
            ) : (
              <span className="text-muted-foreground">{item.motion_text ?? "on a motion"}</span>
            )}
          </p>
          <div className="mt-3">
            <SourceTag source={hostOf(item.sourceUrl)} url={item.sourceUrl ?? "#"} />
          </div>
        </div>
      </div>
    </RowFrame>
  );
}

function BillRow({ item }: { item: FeedBill }) {
  return (
    <RowFrame accent="cyan" icon={FileText} kind="Bill introduced" time={item.date}>
      <div className="flex items-center gap-2 flex-wrap mb-1.5">
        <BillStatusPill status={item.status} />
        <span className="mono-label">
          {(item.level ?? "state").toUpperCase()}
          {item.session ? ` · ${item.session}` : ""}
        </span>
      </div>
      <p className="text-sm leading-snug">
        {item.detailUrl ? (
          <a href={item.detailUrl} target="_blank" rel="noopener noreferrer" className="font-mono text-cyan font-semibold hover:underline inline-flex items-center gap-1">
            {item.identifier}
            <ExternalLink className="h-2.5 w-2.5" />
          </a>
        ) : (
          <span className="font-mono text-cyan font-semibold">{item.identifier}</span>
        )}
        <span className="text-foreground"> — {item.title}</span>
      </p>
      <div className="mt-3">
        <SourceTag source={hostOf(item.sourceUrl)} url={item.sourceUrl ?? "#"} />
      </div>
    </RowFrame>
  );
}

function ContribRow({ item, roster }: { item: FeedContribution; roster: Map<string, RosterOfficial> }) {
  const o = item.officialId ? roster.get(item.officialId) : undefined;
  const party = toPartyCode(o?.party);
  return (
    <RowFrame accent="green" icon={Banknote} kind="Contribution" time={item.date}>
      <div className="flex items-center gap-x-2 gap-y-1 flex-wrap">
        <span className="font-mono font-bold tabular-nums text-status-green">{fmtMoney(item.amount)}</span>
        <span className="text-sm text-muted-foreground">from</span>
        <span className="text-sm font-medium truncate">{item.donor_name}</span>
        {item.is_self_funding ? (
          <span className="font-mono text-[11px] uppercase tracking-widest text-status-yellow border border-status-yellow/50 bg-status-yellow/10 px-1.5 py-0.5 rounded-[2px]">
            SELF-FUNDING
          </span>
        ) : (
          <span className="font-mono text-[11px] uppercase tracking-widest text-cyan border border-cyan/40 px-1.5 py-0.5 rounded-[2px]">
            OUTSIDE
          </span>
        )}
      </div>
      <div className="mt-1.5 flex items-center gap-2 flex-wrap text-sm">
        <span className="text-muted-foreground">to</span>
        {o ? (
          <Link to="/officials/$id" params={{ id: officialSlug(o.ocd_person_id) }} className="font-semibold hover:text-amber truncate inline-flex items-center gap-1.5">
            {o.full_name}
            <PartyDot party={party} />
          </Link>
        ) : item.officialId ? (
          <Link to="/officials/$id" params={{ id: officialSlug(item.officialId) }} className="font-semibold hover:text-amber truncate">
            recipient campaign
          </Link>
        ) : (
          <span className="font-semibold text-muted-foreground">a campaign</span>
        )}
        {o?.district && <OfficeTag level="state" text={`Dist ${o.district}`} />}
      </div>
      <div className="mt-3">
        <SourceTag source={hostOf(item.sourceUrl)} url={item.sourceUrl ?? "#"} />
      </div>
    </RowFrame>
  );
}

// ---- right rail (all real) --------------------------------------------------

function RecordCounts() {
  const countsQuery = useQuery({
    queryKey: ["feed-record-counts"],
    queryFn: async () => ({
      votes: await fetchEstimatedCount("votes"),
      bills: await fetchEstimatedCount("bills"),
      contributions: await fetchEstimatedCount("contributions"),
      officials: await fetchEstimatedCount("officials"),
    }),
    enabled: supabaseConfigured,
    staleTime: Infinity,
  });
  const c = countsQuery.data;
  const rows: [string, number | undefined, string][] = [
    ["Roll-call votes", c?.votes, "text-amber"],
    ["Bills tracked", c?.bills, "text-cyan"],
    ["Contributions", c?.contributions, "text-status-green"],
    ["Officials", c?.officials, "text-foreground"],
  ];
  return (
    <div className="border border-border bg-surface rounded-sm p-4">
      <div className="mono-label text-amber mb-3">ON THE RECORD</div>
      <ul className="space-y-2.5">
        {rows.map(([label, n, tint]) => (
          <li key={label} className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">{label}</span>
            <span className={`font-mono font-bold tabular-nums ${tint}`}>
              {n != null ? n.toLocaleString() : "—"}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-3 mono-label">SOURCE · PUBLIC RECORDS · EST. COUNTS</div>
    </div>
  );
}

function TopFunded({ roster }: { roster: Map<string, RosterOfficial> }) {
  const financeQuery = useQuery({
    queryKey: ["all-campaign-finance"],
    queryFn: fetchAllCampaignFinance,
    enabled: supabaseConfigured && !!supabase,
    staleTime: 5 * 60_000,
  });
  const top = useMemo(() => {
    const rows = financeQuery.data ?? [];
    return [...rows].sort((a, b) => b.outside - a.outside).slice(0, 6);
  }, [financeQuery.data]);

  return (
    <div className="border border-border bg-surface rounded-sm p-4">
      <div className="mono-label text-cyan mb-3">TOP OUTSIDE MONEY</div>
      {financeQuery.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 bg-surface-2 animate-pulse rounded-sm" />
          ))}
        </div>
      ) : (
        <ol className="space-y-2">
          {top.map((c, i) => {
            const o = roster.get(c.official_id);
            return (
              <li key={c.campaign_id}>
                <Link to="/officials/$id" params={{ id: officialSlug(c.official_id) }} className="flex items-center gap-3 group">
                  <span className="font-mono text-xs text-muted-foreground w-5">{i + 1}.</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate group-hover:text-amber">
                      {o?.full_name ?? c.official_id}
                    </div>
                    <div className="font-mono text-[11px] text-muted-foreground uppercase tracking-wider">
                      {electionLabel(c.election_id)}
                    </div>
                  </div>
                  <span className="font-mono text-sm text-cyan tabular-nums shrink-0">
                    {fmtMoney(c.outside)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
      <div className="mt-3 mono-label">SOURCE · FL DOE CAMPAIGN FILINGS</div>
    </div>
  );
}

// ---- shared bits ------------------------------------------------------------

function PageButton({ dir, disabled, onClick }: { dir: "prev" | "next"; disabled: boolean; onClick: () => void }) {
  const Icon = dir === "prev" ? ChevronLeft : ChevronRight;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest px-3 py-2 border border-border rounded-sm text-foreground transition hover:border-amber hover:text-amber disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-foreground"
    >
      {dir === "prev" && <Icon className="h-3.5 w-3.5" />}
      {dir === "prev" ? "Prev" : "Next"}
      {dir === "next" && <Icon className="h-3.5 w-3.5" />}
    </button>
  );
}

function SkeletonList() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="border border-border border-l-2 border-l-border bg-surface rounded-sm p-4 md:p-5">
          <div className="h-3 w-1/4 bg-surface-2 animate-pulse rounded-sm mb-3" />
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-sm bg-surface-2 animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-1/3 bg-surface-2 animate-pulse rounded-sm" />
              <div className="h-3 w-2/3 bg-surface-2 animate-pulse rounded-sm" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyNotice() {
  return (
    <div className="border border-border bg-surface rounded-sm p-8 text-center">
      <div className="mono-label text-amber">NO_RECORDS</div>
      <p className="mt-2 text-sm text-muted-foreground">Nothing in the stream for this filter.</p>
    </div>
  );
}

function ErrorNotice({ message }: { message: string }) {
  return (
    <div className="border border-status-red/50 bg-status-red/5 rounded-sm p-6">
      <div className="mono-label text-status-red">QUERY_FAULT</div>
      <p className="mt-2 text-sm text-foreground">Couldn't load the feed from Supabase.</p>
      <p className="mt-1 font-mono text-[11px] text-muted-foreground break-all">{message}</p>
    </div>
  );
}

function ConfigureNotice() {
  return (
    <div className="border border-border bg-surface rounded-sm p-6">
      <div className="mono-label text-amber">SUPABASE // NOT_CONFIGURED</div>
      <p className="mt-2 text-sm text-foreground">
        The Feed reads live data from Supabase. Add credentials to{" "}
        <span className="font-mono text-cyan">.env.local</span> and restart the dev server.
      </p>
    </div>
  );
}
