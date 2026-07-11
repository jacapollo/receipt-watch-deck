import { createFileRoute, Link, Outlet, useChildMatches } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import {
  OfficialAvatar,
  OfficeTag,
  PartyDot,
  LevelFilterBar,
  SectionHeader,
} from "@/components/polysnitch/Primitives";
import { partyColor } from "@/lib/mock-data";
import {
  chamberLabel,
  fetchOfficials,
  levelOf,
  officialSlug,
  toPartyCode,
  type OfficialRow,
} from "@/lib/records";
import { supabaseConfigured } from "@/lib/supabase";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

const PAGE_SIZE = 30;

export const Route = createFileRoute("/officials")({
  head: () => ({
    meta: [
      { title: "Officials · PolySnitch" },
      { name: "description", content: "Browse officials and open their dossier." },
    ],
  }),
  component: OfficialsPage,
});

function OfficialsPage() {
  const childMatches = useChildMatches();
  const [level, setLevel] = useState<"all" | "federal" | "state" | "local">("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);

  const query = useQuery({
    queryKey: ["officials", page, level, q],
    queryFn: () => fetchOfficials({ page, level, search: q, pageSize: PAGE_SIZE }),
    enabled: supabaseConfigured,
    placeholderData: keepPreviousData,
  });

  if (childMatches.length > 0) return <Outlet />;

  const rows = query.data?.rows ?? [];
  const total = query.data?.total ?? 0;
  const maxPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);

  const reset = (fn: () => void) => {
    fn();
    setPage(0);
  };

  return (
    <AppShell>
      <div className="px-4 md:px-8 py-6 md:py-8 max-w-[1600px] mx-auto">
        <SectionHeader
          eyebrow="ROSTER // SUBJECTS"
          title="Officials"
          right={
            <span className="mono-label hidden md:inline">
              {supabaseConfigured ? `${total.toLocaleString()} SUBJECTS` : "OFFLINE"}
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
              placeholder="Search name or district…"
              className="bg-transparent outline-none text-sm flex-1 placeholder:text-muted-foreground/60"
            />
          </div>
        </div>

        {!supabaseConfigured ? (
          <ConfigureNotice />
        ) : query.isError ? (
          <ErrorNotice message={(query.error as Error).message} />
        ) : query.isLoading ? (
          <SkeletonGrid />
        ) : rows.length === 0 ? (
          <EmptyNotice />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {rows.map((o) => (
                <OfficialCard key={o.ocd_person_id} official={o} />
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

function OfficialCard({ official: o }: { official: OfficialRow }) {
  const party = toPartyCode(o.party);
  return (
    <Link
      to="/officials/$id"
      params={{ id: officialSlug(o.ocd_person_id) }}
      className="group border border-border bg-surface hover:border-amber/60 rounded-sm p-4 transition"
    >
      <div className="flex items-start gap-3">
        <OfficialAvatar
          official={{ name: o.full_name, photoSeed: o.ocd_person_id, party }}
          size={48}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold truncate group-hover:text-amber">{o.full_name}</span>
            <PartyDot party={party} />
          </div>
          <OfficeTag level={levelOf(o.level)} text={o.district ? `Dist ${o.district}` : "—"} />
          <div className="mt-1 text-xs text-muted-foreground">{o.office ?? "—"}</div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
        <div>
          <div className="text-foreground font-bold text-sm">{chamberLabel(o.chamber)}</div>
          chamber
        </div>
        <div>
          <div className="text-foreground font-bold text-sm">{o.district ?? "—"}</div>
          district
        </div>
        <div>
          <div className="font-bold text-sm" style={{ color: partyColor(party) }}>
            {party}
          </div>
          party
        </div>
      </div>
    </Link>
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

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className="border border-border bg-surface rounded-sm p-4">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-sm bg-surface-2 animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-2/3 bg-surface-2 animate-pulse rounded-sm" />
              <div className="h-3 w-1/2 bg-surface-2 animate-pulse rounded-sm" />
            </div>
          </div>
          <div className="mt-4 h-8 bg-surface-2 animate-pulse rounded-sm" />
        </div>
      ))}
    </div>
  );
}

function EmptyNotice() {
  return (
    <div className="border border-border bg-surface rounded-sm p-8 text-center">
      <div className="mono-label text-amber">NO_SUBJECTS</div>
      <p className="mt-2 text-sm text-muted-foreground">No officials match this filter.</p>
    </div>
  );
}

function ErrorNotice({ message }: { message: string }) {
  return (
    <div className="border border-status-red/50 bg-status-red/5 rounded-sm p-6">
      <div className="mono-label text-status-red">QUERY_FAULT</div>
      <p className="mt-2 text-sm text-foreground">Couldn't load the roster from Supabase.</p>
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
