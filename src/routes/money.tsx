import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Banknote, PiggyBank, Landmark, Wallet } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import {
  OfficeTag,
  OfficialAvatar,
  PartyDot,
  SectionHeader,
  StatTile,
} from "@/components/polysnitch/Primitives";
import {
  electionLabel,
  fetchAllCampaignFinance,
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
      { name: "description", content: "Campaign money, straight from the filings — outside donors vs self-funding." },
    ],
  }),
  component: MoneyPage,
});

type Board = "outside" | "self";

function MoneyPage() {
  const [board, setBoard] = useState<Board>("outside");

  const financeQuery = useQuery({
    queryKey: ["all-campaign-finance"],
    queryFn: fetchAllCampaignFinance,
    enabled: supabaseConfigured && !!supabase,
    staleTime: 5 * 60_000,
  });
  const rosterQuery = useQuery({
    queryKey: ["officials-index"],
    queryFn: fetchOfficialsIndex,
    enabled: supabaseConfigured,
    staleTime: 5 * 60_000,
  });

  const campaigns = financeQuery.data ?? [];
  const roster = useMemo(
    () => new Map((rosterQuery.data ?? []).map((o) => [o.ocd_person_id, o])),
    [rosterQuery.data],
  );

  const totals = useMemo(() => {
    let total = 0, self = 0, outside = 0;
    for (const c of campaigns) { total += c.total; self += c.self_funded; outside += c.outside; }
    return { total, self, outside };
  }, [campaigns]);

  const board_rows = useMemo(() => {
    const key = board === "outside" ? "outside" : "self_funded";
    return [...campaigns].sort((a, b) => (b[key] as number) - (a[key] as number)).slice(0, 25);
  }, [campaigns, board]);

  return (
    <AppShell>
      <div className="px-4 md:px-8 py-6 md:py-8 max-w-[1400px] mx-auto">
        <SectionHeader
          eyebrow="CAMPAIGN FINANCE // RECEIPTS"
          title="Money"
          right={
            <span className="mono-label hidden md:inline">
              {financeQuery.data ? `${campaigns.length} CAMPAIGNS TRACKED` : "LOADING…"}
            </span>
          }
        />

        {!supabaseConfigured ? (
          <div className="border border-border bg-surface rounded-sm p-6">
            <div className="mono-label text-amber">SUPABASE // NOT_CONFIGURED</div>
            <p className="mt-2 text-sm text-foreground">
              Add credentials to <span className="font-mono text-cyan">.env.local</span> and restart.
            </p>
          </div>
        ) : financeQuery.isError ? (
          <div className="border border-status-red/50 bg-status-red/5 rounded-sm p-6">
            <div className="mono-label text-status-red">QUERY_FAULT</div>
            <p className="mt-1 font-mono text-[11px] text-muted-foreground break-all">
              {(financeQuery.error as Error).message}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <StatTile label="TRACKED RAISED" value={financeQuery.data ? fmtMoney(totals.total) : "—"} icon={Landmark} tone="amber" sub="all cycles, all campaigns" />
              <StatTile label="FROM OUTSIDE DONORS" value={financeQuery.data ? fmtMoney(totals.outside) : "—"} icon={Banknote} tone="cyan" />
              <StatTile label="SELF-FUNDED" value={financeQuery.data ? fmtMoney(totals.self) : "—"} icon={PiggyBank} tone="yellow" sub="candidates funding themselves" />
              <StatTile label="CAMPAIGNS" value={financeQuery.data ? campaigns.length : "—"} icon={Wallet} sub="per official, per cycle" />
            </div>

            <div className="flex items-center gap-3 flex-wrap mb-4">
              <span className="mono-label mr-1">LEADERBOARD</span>
              <div className="flex border border-border bg-surface rounded-sm overflow-hidden">
                {([["outside", "Top outside money"], ["self", "Top self-funders"]] as [Board, string][]).map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setBoard(id)}
                    className={`px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest transition ${
                      board === id ? "bg-amber text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-surface-2"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {financeQuery.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-14 border border-border bg-surface rounded-sm animate-pulse" />
                ))}
              </div>
            ) : (
              <ul className="divide-y divide-border border border-border rounded-sm bg-surface">
                {board_rows.map((c, i) => (
                  <LeaderRow key={c.campaign_id} rank={i + 1} campaign={c} board={board} official={roster.get(c.official_id)} />
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

function LeaderRow({
  rank, campaign: c, board, official,
}: {
  rank: number;
  campaign: CampaignFinanceRow;
  board: Board;
  official?: { full_name: string; party: string | null; chamber: string | null; district: string | null };
}) {
  const amount = board === "outside" ? c.outside : c.self_funded;
  const party = toPartyCode(official?.party);
  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      <span className="font-mono text-[11px] text-muted-foreground w-6 text-right shrink-0">{rank}</span>
      <OfficialAvatar official={{ name: official?.full_name ?? "?", photoSeed: c.official_id, party }} size={32} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            to="/officials/$id"
            params={{ id: officialSlug(c.official_id) }}
            className="text-sm font-medium hover:text-amber truncate"
          >
            {official?.full_name ?? c.official_id}
          </Link>
          <PartyDot party={party} />
          <OfficeTag level="state" text={official?.district ? `Dist ${official.district}` : "—"} />
        </div>
        <div className="mono-label">
          {electionLabel(c.election_id)} · {c.contribution_count.toLocaleString()} contributions
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className={`font-mono font-bold tabular-nums ${board === "self" ? "text-status-yellow" : "text-cyan"}`}>
          {fmtMoney(amount)}
        </div>
        <div className="mono-label">
          {board === "outside" ? `+${fmtMoney(c.self_funded)} self` : `+${fmtMoney(c.outside)} outside`}
        </div>
      </div>
    </li>
  );
}
