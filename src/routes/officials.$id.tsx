import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import {
  ActionCard,
  OfficialAvatar,
  OfficeTag,
  PartyDot,
  StatTile,
  SectionHeader,
  ReportButton,
} from "@/components/polysnitch/Primitives";
import {
  getOfficial,
  getActionsFor,
  funding,
  threads,
  formatTimeAgo,
} from "@/lib/mock-data";
import {
  FileText,
  CalendarCheck,
  DollarSign,
  Crosshair,
  ArrowBigUp,
  ArrowBigDown,
  MessageSquare,
  ArrowLeft,
} from "lucide-react";

export const Route = createFileRoute("/officials/$id")({
  loader: ({ params }) => {
    const o = getOfficial(params.id);
    if (!o) throw notFound();
    return { official: o };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.official.name ?? "Dossier"} · PolySnitch` },
      {
        name: "description",
        content: `Public-record dossier: votes, bills, funding, and discussion for ${loaderData?.official.name}.`,
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
  const [tab, setTab] = useState<Tab>("activity");
  const officialActions = getActionsFor(official.id);
  const officialFunding = funding[official.id] ?? [];
  const officialThreads = threads.filter((t) => t.relatedOfficialId === official.id);

  const totalFunding = officialFunding.reduce((s, x) => s + x.amount, 0);
  const sectorTotals = officialFunding.reduce<Record<string, number>>((acc, x) => {
    acc[x.sector] = (acc[x.sector] || 0) + x.amount;
    return acc;
  }, {});
  const sectorMax = Math.max(...Object.values(sectorTotals));

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
            <OfficialAvatar official={official} size={88} />
            <div className="min-w-0">
              <div className="mono-label text-amber">
                {official.level.toUpperCase()} · {official.state}
              </div>
              <h1 className="mt-1 text-2xl md:text-4xl font-black tracking-tight">
                {official.name}
              </h1>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <PartyDot party={official.party} />
                <OfficeTag level={official.level} text={official.office} />
                <span className="mono-label">DIST · {official.district}</span>
              </div>

              <dl className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                {[
                  ["TERM START", official.termStart],
                  ["TERM END", official.termEnd],
                  ["PARTY", official.party],
                  ["LEVEL", official.level.toUpperCase()],
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

        {/* Accountability snapshot */}
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatTile label="BILLS SPONSORED" value={official.stats.billsSponsored} icon={FileText} tone="amber" />
          <StatTile
            label="ATTENDANCE"
            value={`${official.stats.attendance}%`}
            icon={CalendarCheck}
            tone={official.stats.attendance >= 90 ? "green" : "yellow"}
          />
          <StatTile
            label="TOP FUNDING SECTOR"
            value={official.stats.topSector.split(" / ")[0]}
            sub={official.stats.topSector}
            icon={DollarSign}
            tone="cyan"
          />
          <StatTile label="ALIGNMENT" value={official.stats.alignment} icon={Crosshair} />
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
              {t}
            </button>
          ))}
        </div>

        {tab === "activity" && (
          <div className="mt-5 space-y-3">
            {officialActions.map((a) => (
              <ActionCard key={a.id} action={a} official={official} />
            ))}
          </div>
        )}

        {tab === "funding" && (
          <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="border border-border bg-surface rounded-sm p-5">
              <div className="mono-label text-amber">BY SECTOR · CYCLE TO DATE</div>
              <div className="mt-4 space-y-3">
                {Object.entries(sectorTotals)
                  .sort((a, b) => b[1] - a[1])
                  .map(([sec, amt]) => (
                    <div key={sec}>
                      <div className="flex items-center justify-between font-mono text-xs">
                        <span className="text-foreground">{sec}</span>
                        <span className="text-amber tabular-nums">${amt.toLocaleString()}</span>
                      </div>
                      <div className="mt-1 h-1.5 bg-surface-2 rounded-[1px] overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber to-cyan"
                          style={{ width: `${(amt / sectorMax) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
              </div>
              <div className="mt-5 pt-4 border-t border-border flex items-center justify-between">
                <span className="mono-label">TOTAL TRACKED</span>
                <span className="font-mono font-bold text-foreground text-lg tabular-nums">
                  ${totalFunding.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="border border-border bg-surface rounded-sm p-5">
              <div className="mono-label text-cyan">TOP DONORS / SOURCES</div>
              <ul className="mt-4 divide-y divide-border">
                {officialFunding
                  .slice()
                  .sort((a, b) => b.amount - a.amount)
                  .map((f, i) => (
                    <li key={i} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{f.donor}</div>
                        <div className="mono-label">
                          {f.type.toUpperCase()} · {f.sector}
                        </div>
                      </div>
                      <div className="font-mono text-sm text-amber tabular-nums shrink-0">
                        ${f.amount.toLocaleString()}
                      </div>
                    </li>
                  ))}
              </ul>
              <div className="mt-4 mono-label">SOURCE · PUBLIC CAMPAIGN FINANCE FILINGS</div>
            </div>
          </div>
        )}

        {tab === "discussion" && (
          <div className="mt-5 space-y-3">
            {officialThreads.length === 0 && (
              <div className="border border-dashed border-border rounded-sm p-8 text-center">
                <div className="mono-label text-amber">NO THREADS YET</div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Be the first to post about this official's public record.
                </p>
              </div>
            )}
            {officialThreads.map((t) => (
              <article key={t.id} className="border border-border bg-surface rounded-sm p-4">
                <div className="flex gap-3">
                  <div className="flex flex-col items-center gap-0.5 shrink-0 font-mono">
                    <ArrowBigUp className="h-4 w-4 text-muted-foreground hover:text-amber cursor-pointer" />
                    <span className="text-xs font-bold">{t.upvotes - t.downvotes}</span>
                    <ArrowBigDown className="h-4 w-4 text-muted-foreground hover:text-status-red cursor-pointer" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link
                      to="/discuss/$id"
                      params={{ id: t.id }}
                      className="font-semibold hover:text-amber"
                    >
                      {t.title}
                    </Link>
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{t.body}</p>
                    <div className="mt-2 flex items-center gap-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      <span>@{t.author}</span>
                      <span>{formatTimeAgo(t.createdAt)}</span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" /> {t.comments.length}
                      </span>
                      <ReportButton />
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="mt-10 pt-5 border-t border-border mono-label text-center">
          PolySnitch tracks the public record of public officials only.
        </div>
      </div>
    </AppShell>
  );
}
