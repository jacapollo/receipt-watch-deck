import { createFileRoute, Link } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { officialSlug } from "@/lib/records";
import { useState } from "react";
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

// ---- real-data shapes (Supabase) -------------------------------------------

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

const PAGE_SIZE = 25;

const VOTE_SELECT =
  "individual_vote_id, option, motion_text, vote_result, vote_date, chamber, source, " +
  "officials(ocd_person_id, full_name, party, office, district), " +
  "bills(id, identifier, title, openstates_url)";

const OPTION_FILTERS = [
  { id: "all", label: "All" },
  { id: "yes", label: "Yea" },
  { id: "no", label: "Nay" },
  { id: "not voting", label: "N/V" },
  { id: "excused", label: "Excused" },
] as const;

type OptionFilter = (typeof OPTION_FILTERS)[number]["id"];

// ---- helpers ----------------------------------------------------------------

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
      return { label: "EXCUSED", cls: "text-status-yellow border-status-yellow/50 bg-status-yellow/10" };
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

function stampOf(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

// ---- data hooks -------------------------------------------------------------

async function fetchVotesPage(page: number, option: OptionFilter): Promise<VoteRow[]> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const from = page * PAGE_SIZE;
  let query = supabase
    .from("votes")
    .select(VOTE_SELECT)
    .order("vote_date", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  if (option !== "all") query = query.eq("option", option);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as VoteRow[];
}

async function fetchEstimatedCount(table: string): Promise<number> {
  if (!supabase) return 0;
  // head + estimated: reads the planner's row estimate, never scans 30k rows.
  const { count } = await supabase.from(table).select("*", { count: "estimated", head: true });
  return count ?? 0;
}

// ---- page -------------------------------------------------------------------

function VotesPage() {
  const [page, setPage] = useState(0);
  const [option, setOption] = useState<OptionFilter>("all");

  const votesQuery = useQuery({
    queryKey: ["votes", page, option],
    queryFn: () => fetchVotesPage(page, option),
    enabled: supabaseConfigured,
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

  const rows = votesQuery.data ?? [];
  const hasNext = rows.length === PAGE_SIZE;

  return (
    <AppShell>
      <div className="px-4 md:px-8 py-6 md:py-8 max-w-[1400px] mx-auto">
        <SectionHeader
          eyebrow="ROLL CALL // LIVE RECORD"
          title="Votes"
          right={
            <span className="mono-label hidden md:inline">
              {countsQuery.data ? `${countsQuery.data.votes.toLocaleString()} ON RECORD` : "LOADING…"}
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

            {/* option filter */}
            <div className="flex items-center gap-3 flex-wrap mb-5">
              <span className="mono-label mr-1">FILTER</span>
              <div className="flex border border-border bg-surface rounded-sm overflow-hidden">
                {OPTION_FILTERS.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => {
                      setOption(o.id);
                      setPage(0);
                    }}
                    className={`px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest transition ${
                      option === o.id
                        ? "bg-amber text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-surface-2"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {votesQuery.isError ? (
              <ErrorNotice message={(votesQuery.error as Error).message} />
            ) : votesQuery.isLoading ? (
              <SkeletonList />
            ) : rows.length === 0 ? (
              <EmptyNotice />
            ) : (
              <div className="space-y-3">
                {rows.map((v) => (
                  <VoteCard key={v.individual_vote_id} vote={v} />
                ))}
              </div>
            )}

            {/* pagination */}
            <div className="mt-6 flex items-center justify-between gap-3">
              <PageButton
                dir="prev"
                disabled={page === 0 || votesQuery.isFetching}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              />
              <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                PAGE {page + 1}
                {votesQuery.isFetching && page > 0 ? " · loading…" : ""}
              </span>
              <PageButton
                dir="next"
                disabled={!hasNext || votesQuery.isFetching}
                onClick={() => setPage((p) => p + 1)}
              />
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

// ---- pieces -----------------------------------------------------------------

function VoteCard({ vote }: { vote: VoteRow }) {
  const o = vote.officials;
  const b = vote.bills;
  const opt = optionDisplay(vote.option);
  const party = toPartyCode(o?.party);

  return (
    <article className="group border border-border bg-surface hover:border-amber/40 hover:bg-surface-2/60 transition rounded-sm p-4 md:p-5">
      <div className="flex items-start gap-3">
        <OfficialAvatar
          official={{ name: o?.full_name ?? "Unknown", photoSeed: o?.ocd_person_id ?? "", party }}
          size={44}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
            {o ? (
              <Link
                to="/officials/$id"
                params={{ id: officialSlug(o.ocd_person_id) }}
                className="font-semibold text-foreground hover:text-amber truncate"
              >
                {o.full_name}
              </Link>
            ) : (
              <span className="font-semibold text-foreground truncate">Unknown official</span>
            )}
            <PartyDot party={party} />
            <OfficeTag level="state" text={o?.district ? `FL · ${o.office ?? "—"} · Dist ${o.district}` : o?.office ?? "—"} />
          </div>

          <div className="mt-1 flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center font-mono text-[11px] font-bold uppercase tracking-widest px-1.5 py-0.5 border rounded-[2px] ${opt.cls}`}
            >
              {opt.label}
            </span>
            <span className="font-mono text-[11px] text-muted-foreground tracking-wider">
              {stampOf(vote.vote_date)}
              {vote.motion_text ? ` · ${vote.motion_text}` : ""}
            </span>
          </div>

          {b && (
            <p className="mt-2 text-sm text-foreground leading-snug">
              <span className="font-mono text-cyan font-semibold">{b.identifier}</span>{" "}
              <span className="text-muted-foreground">— {b.title}</span>
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
        <div key={i} className="border border-border bg-surface rounded-sm p-4 md:p-5">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-sm bg-surface-2 animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-1/3 bg-surface-2 animate-pulse rounded-sm" />
              <div className="h-3 w-1/4 bg-surface-2 animate-pulse rounded-sm" />
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
      <p className="mt-2 text-sm text-muted-foreground">No votes match this filter.</p>
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
      <pre className="mt-3 text-[12px] font-mono bg-background border border-border rounded-sm p-3 overflow-x-auto text-muted-foreground">
        {`VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-or-publishable-key>`}
      </pre>
    </div>
  );
}
