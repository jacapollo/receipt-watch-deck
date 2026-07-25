import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import {
  OfficialAvatar,
  OfficeTag,
  PartyDot,
  StatTile,
  SourceTag,
} from "@/components/polysnitch/Primitives";
import { CommentThread } from "@/components/polysnitch/CommentThread";
import {
  chamberLabel,
  electionLabel,
  fetchCampaignDonors,
  fetchOfficialBySlug,
  fetchOfficialFinance,
  fetchOfficialVoteStats,
  fetchOfficialVotes,
  fmtMoney,
  hostOf,
  levelOf,
  optionDisplay,
  stampOf,
  toPartyCode,
  DONOR_PAGE_SIZE,
  PAGE_SIZE,
  type CampaignFinanceRow,
  type VoteRow,
} from "@/lib/records";
import {
  Gavel,
  ThumbsUp,
  ThumbsDown,
  CalendarClock,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { TrackButton } from "@/components/polysnitch/TrackButton";

export const Route = createFileRoute("/officials/$id")({
  loader: async ({ params }) => {
    const official = await fetchOfficialBySlug(params.id);
    if (!official) throw notFound();
    return { official };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.official.full_name ?? "Dossier"} · PolySnitch` },
      {
        name: "description",
        content: `Public-record dossier: votes and discussion for ${loaderData?.official.full_name}.`,
      },
    ],
  }),
  errorComponent: ({ error }) => (
    <AppShell>
      <div className="p-8">Error loading dossier: {error.message}</div>
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell>
      <div className="p-8">
        <p className="mono-label text-amber">404 · UNKNOWN SUBJECT</p>
        <Link to="/officials" className="text-amber hover:underline mt-2 inline-block">
          ← Back to roster
        </Link>
      </div>
    </AppShell>
  ),
  component: DossierPage,
});

type Tab = "activity" | "funding" | "discussion";

function DossierPage() {
  const { official } = Route.useLoaderData();
  const officialId = official.ocd_person_id;
  const [tab, setTab] = useState<Tab>("activity");
  const [votePage, setVotePage] = useState(0);

  const party = toPartyCode(official.party);
  const level = levelOf(official.level);

  const statsQuery = useQuery({
    queryKey: ["official-stats", officialId],
    queryFn: () => fetchOfficialVoteStats(officialId),
    staleTime: 60_000,
  });

  const votesQuery = useQuery({
    queryKey: ["official-votes", officialId, votePage],
    queryFn: () => fetchOfficialVotes(officialId, votePage),
    placeholderData: keepPreviousData,
  });

  const stats = statsQuery.data;
  const votes = votesQuery.data ?? [];
  const hasNext = votes.length === PAGE_SIZE;

  return (
    <AppShell>
      <div className="px-4 md:px-8 py-6 md:py-8 max-w-[1400px] mx-auto">
        <Link
          to="/officials"
          className="inline-flex items-center gap-1.5 mono-label text-muted-foreground hover:text-amber mb-4"
        >
          <ArrowLeft className="h-3 w-3" /> ROSTER
        </Link>

        {/* Case file header */}
        <div className="border border-border bg-surface rounded-sm p-5 md:p-6 relative overflow-hidden">
          <div className="absolute inset-0 hud-scanlines pointer-events-none opacity-50" />
          <div className="absolute top-3 right-3 mono-label text-status-red flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-status-red animate-pulse" />
            CASE FILE · OPEN
          </div>

          <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-5 items-start">
            <OfficialAvatar
              official={{ name: official.full_name, photoSeed: officialId, party }}
              size={88}
            />
            <div className="min-w-0">
              <div className="mono-label text-amber">
                {level.toUpperCase()} · {official.state ?? "—"}
              </div>
              <h1 className="mt-1 text-2xl md:text-4xl font-black tracking-tight">
                {official.full_name}
              </h1>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <PartyDot party={party} />
                <OfficeTag level={level} text={official.office ?? "—"} />
                <span className="mono-label">DIST · {official.district ?? "—"}</span>
                <TrackButton kind="official" id={officialId} size="sm" />
                {official.district && (
                  <Link
                    to="/discuss"
                    search={{
                      scope:
                        official.level === "federal"
                          ? `federal:US:${official.district}`
                          : `state:${official.state ?? "FL"}:${official.district}`,
                    }}
                    className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-widest text-muted-foreground hover:text-amber border border-border hover:border-amber px-2 py-1 rounded-[2px] transition"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan shrink-0" />
                    Discuss
                  </Link>
                )}
              </div>

              <dl className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                {[
                  ["PARTY", official.party ?? "—"],
                  ["CHAMBER", chamberLabel(official.chamber)],
                  ["DISTRICT", official.district ?? "—"],
                  ["LEVEL", level.toUpperCase()],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="mono-label">{k}</dt>
                    <dd className="font-mono text-sm text-foreground mt-0.5">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>

        {/* Accountability snapshot — real vote-derived stats */}
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatTile
            label="VOTES CAST"
            value={stats ? stats.total.toLocaleString() : "—"}
            icon={Gavel}
            tone="amber"
          />
          <StatTile
            label="YEA"
            value={stats ? stats.yes.toLocaleString() : "—"}
            icon={ThumbsUp}
            tone="green"
          />
          <StatTile
            label="NAY"
            value={stats ? stats.no.toLocaleString() : "—"}
            icon={ThumbsDown}
            tone="red"
          />
          <StatTile
            label="LAST VOTE"
            value={stats?.lastVote ? stampOf(stats.lastVote) : "—"}
            icon={CalendarClock}
            tone="cyan"
          />
        </div>

        {/* Tabs */}
        <div className="mt-6 border-b border-border flex gap-1">
          {(["activity", "funding", "discussion"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 font-mono text-[11px] uppercase tracking-widest border-b-2 -mb-px transition ${
                tab === t
                  ? "border-amber text-amber"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "activity" ? "votes" : t}
            </button>
          ))}
        </div>

        {tab === "activity" && (
          <div className="mt-5">
            {votesQuery.isError ? (
              <Notice tone="red" label="QUERY_FAULT" body={(votesQuery.error as Error).message} />
            ) : votesQuery.isLoading ? (
              <VoteSkeleton />
            ) : votes.length === 0 ? (
              <Notice label="NO_VOTES" body="No recorded roll-call votes for this official yet." />
            ) : (
              <>
                <div className="space-y-3">
                  {votes.map((v) => (
                    <OfficialVoteRow key={v.individual_vote_id} vote={v} />
                  ))}
                </div>
                <div className="mt-6 flex items-center justify-between gap-3">
                  <PageButton
                    dir="prev"
                    disabled={votePage === 0 || votesQuery.isFetching}
                    onClick={() => setVotePage((p) => Math.max(0, p - 1))}
                  />
                  <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                    PAGE {votePage + 1}
                  </span>
                  <PageButton
                    dir="next"
                    disabled={!hasNext || votesQuery.isFetching}
                    onClick={() => setVotePage((p) => p + 1)}
                  />
                </div>
              </>
            )}
          </div>
        )}

        {tab === "funding" && <FundingTab officialId={officialId} />}

        {tab === "discussion" && <CommentThread parentType="official" parentId={officialId} />}

        <div className="mt-10 pt-5 border-t border-border mono-label text-center">
          PolySnitch tracks the public record of public officials only.
        </div>
      </div>
    </AppShell>
  );
}

function FundingTab({ officialId }: { officialId: string }) {
  const financeQuery = useQuery({
    queryKey: ["official-finance", officialId],
    queryFn: () => fetchOfficialFinance(officialId),
    staleTime: 60_000,
  });

  const campaigns = financeQuery.data ?? [];

  if (financeQuery.isError) {
    return (
      <div className="mt-5">
        <Notice tone="red" label="QUERY_FAULT" body={(financeQuery.error as Error).message} />
      </div>
    );
  }
  if (financeQuery.isLoading) {
    return (
      <div className="mt-5 space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="border border-border bg-surface rounded-sm p-5 h-40 animate-pulse"
          />
        ))}
      </div>
    );
  }
  if (campaigns.length === 0) {
    return (
      <div className="mt-5">
        <Notice
          label="NO FUNDING ON RECORD"
          body="No campaign-finance filings are on record for this official."
        />
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-4">
      {campaigns.map((c) => (
        <CampaignCard key={c.campaign_id} campaign={c} />
      ))}
      <div className="mono-label text-center">
        SOURCE · FLORIDA DIVISION OF ELECTIONS CAMPAIGN FINANCE DATABASE
      </div>
    </div>
  );
}

function CampaignCard({ campaign: c }: { campaign: CampaignFinanceRow }) {
  const [donorPage, setDonorPage] = useState(0);
  const donorsQuery = useQuery({
    queryKey: ["campaign-donors", c.campaign_id, donorPage],
    queryFn: () => fetchCampaignDonors(c.campaign_id, donorPage),
    placeholderData: keepPreviousData,
  });
  const donors = donorsQuery.data ?? [];
  const hasNext = donors.length === DONOR_PAGE_SIZE;
  const outsidePct = c.total > 0 ? (c.outside / c.total) * 100 : 0;

  return (
    <div className="border border-border bg-surface rounded-sm p-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="mono-label text-amber">{electionLabel(c.election_id)}</div>
          <div className="mt-0.5 text-sm text-muted-foreground">
            {c.office_as_filed ?? "—"}
            {c.district_as_filed ? ` · Dist ${c.district_as_filed}` : ""}
            {c.party_as_filed ? ` · (${c.party_as_filed})` : ""}
            <span className="mono-label ml-2">ACCT {c.fl_doe_account ?? "—"}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono font-bold text-foreground text-lg tabular-nums">
            {fmtMoney(c.total)}
          </div>
          <div className="mono-label">{c.contribution_count.toLocaleString()} CONTRIBUTIONS</div>
        </div>
      </div>

      {/* outside vs self-funded split — never a single combined number */}
      <div className="mt-4">
        <div className="flex items-center justify-between font-mono text-xs">
          <span className="text-cyan">{fmtMoney(c.outside)} from outside donors</span>
          <span className="text-status-yellow">{fmtMoney(c.self_funded)} self-funded</span>
        </div>
        <div className="mt-1 h-1.5 bg-surface-2 rounded-[1px] overflow-hidden flex">
          <div className="h-full bg-cyan" style={{ width: `${outsidePct}%` }} />
          <div className="h-full bg-status-yellow" style={{ width: `${100 - outsidePct}%` }} />
        </div>
      </div>

      <div className="mt-4">
        <div className="mono-label text-cyan mb-2">TOP OUTSIDE DONORS</div>
        {donorsQuery.isLoading ? (
          <div className="h-24 bg-surface-2 animate-pulse rounded-sm" />
        ) : donors.length === 0 ? (
          <p className="text-sm text-muted-foreground">No outside contributions on record.</p>
        ) : (
          <ul className="divide-y divide-border border border-border rounded-sm bg-surface">
            {donors.map((d) => (
              <li
                key={`${d.donor_name}-${d.total}`}
                className="py-2 px-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{d.donor_name}</div>
                  <div className="mono-label">
                    {d.contribution_count} CONTRIBUTION{d.contribution_count === 1 ? "" : "S"}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono text-sm text-amber tabular-nums">
                    {fmtMoney(d.total)}
                  </span>
                  <SourceTag source={hostOf(d.receipt_url)} url={d.receipt_url ?? "#"} />
                </div>
              </li>
            ))}
          </ul>
        )}
        {(donorPage > 0 || hasNext) && (
          <div className="mt-3 flex items-center justify-between">
            <PageButton
              dir="prev"
              disabled={donorPage === 0 || donorsQuery.isFetching}
              onClick={() => setDonorPage((p) => Math.max(0, p - 1))}
            />
            <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              PAGE {donorPage + 1}
            </span>
            <PageButton
              dir="next"
              disabled={!hasNext || donorsQuery.isFetching}
              onClick={() => setDonorPage((p) => p + 1)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function OfficialVoteRow({ vote }: { vote: VoteRow }) {
  const opt = optionDisplay(vote.option);
  const b = vote.bills;
  return (
    <article className="border border-border bg-surface hover:border-amber/40 transition rounded-sm p-4">
      <div className="flex items-start gap-3">
        <span
          className={`shrink-0 inline-flex items-center font-mono text-[11px] font-bold uppercase tracking-widest px-1.5 py-0.5 border rounded-[2px] ${opt.cls}`}
        >
          {opt.label}
        </span>
        <div className="min-w-0 flex-1">
          {b && (
            <p className="text-sm text-foreground leading-snug">
              <span className="font-mono text-cyan font-semibold">{b.identifier}</span>{" "}
              <span className="text-muted-foreground">— {b.title}</span>
            </p>
          )}
          <div className="mt-1 font-mono text-[11px] text-muted-foreground tracking-wider">
            {stampOf(vote.vote_date)}
            {vote.motion_text ? ` · ${vote.motion_text}` : ""}
          </div>
          <div className="mt-2">
            <SourceTag source={hostOf(vote.source?.url)} url={vote.source?.url ?? "#"} />
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
      className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest px-3 py-2 border border-border rounded-sm text-foreground transition hover:border-amber hover:text-amber disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-foreground"
    >
      {dir === "prev" && <Icon className="h-3.5 w-3.5" />}
      {dir === "prev" ? "Prev" : "Next"}
      {dir === "next" && <Icon className="h-3.5 w-3.5" />}
    </button>
  );
}

function VoteSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="border border-border bg-surface rounded-sm p-4">
          <div className="flex items-start gap-3">
            <div className="h-5 w-12 rounded-[2px] bg-surface-2 animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-2/3 bg-surface-2 animate-pulse rounded-sm" />
              <div className="h-3 w-1/3 bg-surface-2 animate-pulse rounded-sm" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Notice({
  label,
  body,
  tone = "amber",
}: {
  label: string;
  body: string;
  tone?: "amber" | "red";
}) {
  const color = tone === "red" ? "text-status-red" : "text-amber";
  return (
    <div className="border border-border bg-surface rounded-sm p-8 text-center">
      <div className={`mono-label ${color}`}>{label}</div>
      <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">{body}</p>
    </div>
  );
}
