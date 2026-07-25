import { createFileRoute, Link } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import {
  BillStatusPill,
  LevelFilterBar,
  OfficeTag,
  OfficialAvatar,
  PartyDot,
  SectionHeader,
  SourceTag,
} from "@/components/polysnitch/Primitives";
import {
  deriveBillStatus,
  fetchBills,
  fetchBillSponsors,
  fetchBillVotes,
  hostOf,
  levelOf,
  officialSlug,
  optionDisplay,
  sponsorOfficialId,
  stampOf,
  toPartyCode,
  type BillRow,
} from "@/lib/records";
import { supabaseConfigured } from "@/lib/supabase";
import { TrackButton } from "@/components/polysnitch/TrackButton";
import { CommentThread } from "@/components/polysnitch/CommentThread";
import { ChevronDown, ChevronRight, ChevronLeft, Search } from "lucide-react";

const PAGE_SIZE = 20;

export const Route = createFileRoute("/bills")({
  head: () => ({
    meta: [
      { title: "Bills & Issues · PolySnitch" },
      { name: "description", content: "Track bills and how officials voted on them." },
    ],
  }),
  component: BillsPage,
});

function BillsPage() {
  const [level, setLevel] = useState<"all" | "federal" | "state" | "local">("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["bills", page, level, q],
    queryFn: () => fetchBills({ page, level, search: q, pageSize: PAGE_SIZE }),
    enabled: supabaseConfigured,
    placeholderData: keepPreviousData,
  });

  const rows = query.data?.rows ?? [];
  const total = query.data?.total ?? 0;
  const maxPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);

  const reset = (fn: () => void) => {
    fn();
    setPage(0);
    setOpen(null);
  };

  return (
    <AppShell>
      <div className="px-4 md:px-8 py-6 md:py-8 max-w-[1400px] mx-auto">
        <SectionHeader
          eyebrow="LEGISLATION // TRACKER"
          title="Bills & Issues"
          right={
            <span className="mono-label hidden md:inline">
              {supabaseConfigured ? `${total.toLocaleString()} BILLS` : "OFFLINE"}
            </span>
          }
        />

        <div className="flex flex-wrap items-center gap-3 mb-5">
          <LevelFilterBar value={level} onChange={(v) => reset(() => setLevel(v))} />
          <div className="flex items-center gap-2 border border-border bg-surface rounded-sm px-3 py-1.5 flex-1 min-w-[200px] max-w-md focus-within:border-amber">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => reset(() => setQ(e.target.value))}
              placeholder="Search bill number or title…"
              className="bg-transparent outline-none text-sm flex-1 placeholder:text-muted-foreground/60"
            />
          </div>
        </div>

        {!supabaseConfigured ? (
          <ConfigureNotice />
        ) : query.isError ? (
          <ErrorNotice message={(query.error as Error).message} />
        ) : query.isLoading ? (
          <SkeletonList />
        ) : rows.length === 0 ? (
          <EmptyNotice />
        ) : (
          <>
            <div className="space-y-3">
              {rows.map((b) => (
                <BillRowCard
                  key={b.id}
                  bill={b}
                  isOpen={open === b.id}
                  onToggle={() => setOpen(open === b.id ? null : b.id)}
                />
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between gap-3">
              <PageButton
                dir="prev"
                disabled={page === 0 || query.isFetching}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              />
              <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                PAGE {page + 1} / {maxPage + 1}
              </span>
              <PageButton
                dir="next"
                disabled={page >= maxPage || query.isFetching}
                onClick={() => setPage((p) => Math.min(maxPage, p + 1))}
              />
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

function BillRowCard({
  bill: b,
  isOpen,
  onToggle,
}: {
  bill: BillRow;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const subjects = (b.subjects ?? []).filter((s) => s && s.length > 1).slice(0, 6);
  return (
    <article className="border border-border bg-surface rounded-sm overflow-hidden">
      <div className="p-4 md:p-5">
        <div className="flex items-start gap-3">
          <button
            onClick={onToggle}
            className="mt-1 text-muted-foreground hover:text-amber shrink-0"
          >
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <BillStatusPill status={deriveBillStatus(b)} />
              <span className="mono-label">
                {(b.level ?? "state").toUpperCase()} · {b.session ?? "—"}
                {b.introduced_date ? ` · INTRO ${stampOf(b.introduced_date)}` : ""}
              </span>
            </div>
            <h3 className="mt-2 text-base md:text-lg font-bold">
              <span className="font-mono text-cyan">{b.identifier}</span> — {b.title}
            </h3>
            {b.official_summary && (
              <p className="mt-1 text-sm text-muted-foreground line-clamp-3">
                {b.official_summary}
              </p>
            )}
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              {subjects.map((t) => (
                <span
                  key={t}
                  className="font-mono text-[11px] uppercase tracking-widest text-cyan border border-cyan/40 px-1.5 py-0.5 rounded-[2px]"
                >
                  {t}
                </span>
              ))}
              {b.source?.url && <SourceTag source={hostOf(b.source.url)} url={b.source.url} />}
            </div>
          </div>
          <TrackButton kind="bill" id={b.id} size="sm" />
        </div>
      </div>

      {isOpen && <BillDetail billId={b.id} />}
    </article>
  );
}

function BillDetail({ billId }: { billId: string }) {
  const sponsorsQuery = useQuery({
    queryKey: ["bill-sponsors", billId],
    queryFn: () => fetchBillSponsors(billId),
  });
  const votesQuery = useQuery({
    queryKey: ["bill-votes", billId],
    queryFn: () => fetchBillVotes(billId),
  });

  const sponsors = sponsorsQuery.data ?? [];
  const votes = votesQuery.data ?? [];

  return (
    <div className="border-t border-border bg-surface-2/40 p-4 md:p-5 space-y-4">
      <div>
        <div className="mono-label text-amber mb-2">SPONSORS</div>
        {sponsorsQuery.isLoading ? (
          <div className="h-6 w-40 bg-surface-2 animate-pulse rounded-sm" />
        ) : sponsors.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sponsors on record.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {sponsors.map((s, i) => {
              const resolvedId = sponsorOfficialId(s);
              const chip = (
                <span
                  className={`flex items-center gap-2 border border-border bg-surface rounded-sm px-2 py-1.5 ${
                    resolvedId ? "hover:border-amber" : ""
                  }`}
                >
                  <span
                    className={`text-xs font-semibold ${resolvedId ? "" : "text-muted-foreground"}`}
                  >
                    {s.raw_name}
                  </span>
                  <span className="mono-label">
                    {(s.classification ?? "sponsor").toUpperCase()}
                  </span>
                </span>
              );
              return resolvedId ? (
                <Link key={i} to="/officials/$id" params={{ id: officialSlug(resolvedId) }}>
                  {chip}
                </Link>
              ) : (
                <div key={i}>{chip}</div>
              );
            })}
          </div>
        )}
      </div>

      <CommentThread parentType="bill" parentId={billId} />

      <div>
        <div className="mono-label text-cyan mb-2">WHO VOTED HOW</div>
        {votesQuery.isLoading ? (
          <div className="h-24 bg-surface-2 animate-pulse rounded-sm" />
        ) : votes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No roll-call votes recorded for this bill.
          </p>
        ) : (
          <ul className="divide-y divide-border border border-border rounded-sm bg-surface max-h-96 overflow-auto">
            {votes.map((v) => {
              const o = v.officials;
              const party = toPartyCode(o?.party);
              const opt = optionDisplay(v.option);
              return (
                <li key={v.individual_vote_id} className="flex items-center gap-3 px-3 py-2">
                  <OfficialAvatar
                    official={{
                      name: o?.full_name ?? "?",
                      photoSeed: o?.ocd_person_id ?? "",
                      party,
                    }}
                    size={28}
                  />
                  <div className="min-w-0 flex-1">
                    {o ? (
                      <Link
                        to="/officials/$id"
                        params={{ id: officialSlug(o.ocd_person_id) }}
                        className="text-sm font-medium hover:text-amber truncate block"
                      >
                        {o.full_name}
                      </Link>
                    ) : (
                      <span className="text-sm font-medium truncate block">Unknown</span>
                    )}
                    <div className="flex items-center gap-2">
                      <PartyDot party={party} />
                      <OfficeTag
                        level="state"
                        text={o?.district ? `Dist ${o.district}` : (o?.office ?? "—")}
                      />
                    </div>
                  </div>
                  <span
                    className={`font-mono text-[11px] uppercase tracking-widest px-2 py-0.5 border rounded-[2px] ${opt.cls}`}
                  >
                    {opt.label}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
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
          <div className="space-y-2">
            <div className="h-3 w-1/4 bg-surface-2 animate-pulse rounded-sm" />
            <div className="h-4 w-2/3 bg-surface-2 animate-pulse rounded-sm" />
            <div className="h-3 w-full bg-surface-2 animate-pulse rounded-sm" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyNotice() {
  return (
    <div className="border border-border bg-surface rounded-sm p-8 text-center">
      <div className="mono-label text-amber">NO_BILLS</div>
      <p className="mt-2 text-sm text-muted-foreground">No bills match this filter.</p>
    </div>
  );
}

function ErrorNotice({ message }: { message: string }) {
  return (
    <div className="border border-status-red/50 bg-status-red/5 rounded-sm p-6">
      <div className="mono-label text-status-red">QUERY_FAULT</div>
      <p className="mt-2 text-sm text-foreground">Couldn't load bills from Supabase.</p>
      <p className="mt-1 font-mono text-[11px] text-muted-foreground break-all">{message}</p>
    </div>
  );
}

function ConfigureNotice() {
  return (
    <div className="border border-border bg-surface rounded-sm p-6">
      <div className="mono-label text-amber">SUPABASE // NOT_CONFIGURED</div>
      <p className="mt-2 text-sm text-foreground">
        Add your project credentials to <span className="font-mono text-cyan">.env.local</span> and
        restart the dev server.
      </p>
    </div>
  );
}
