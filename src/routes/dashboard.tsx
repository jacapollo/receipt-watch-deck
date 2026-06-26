import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  DollarSign,
  FileText,
  Users as UsersIcon,
  Vote,
  ScrollText,
  Radio,
  LayoutDashboard,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import {
  BillStatusPill,
  OfficialAvatar,
  PartyDot,
  SectionHeader,
  StatTile,
} from "@/components/polysnitch/Primitives";
import { bills, getOfficial, officials } from "@/lib/mock-data";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard · PolySnitch" },
      {
        name: "description",
        content:
          "Florida situational overview: a factual brief of verified public records on officials, bills, votes, and money.",
      },
    ],
  }),
  component: DashboardPage,
});

type Lens = {
  id: string;
  label: string;
  to?: "/bills" | "/feed";
  soon?: boolean;
  active?: boolean;
};

const lenses: Lens[] = [
  { id: "overview", label: "Overview", active: true },
  { id: "money", label: "Money", soon: true },
  { id: "votes", label: "Votes", soon: true },
  { id: "bills", label: "Bills", to: "/bills" },
  { id: "feed", label: "Feed", to: "/feed" },
];

const sectors = [
  { label: "Real estate", amount: 1840000 },
  { label: "Healthcare", amount: 1320000 },
  { label: "Energy / Utilities", amount: 1105000 },
  { label: "Legal", amount: 742000 },
  { label: "Agriculture", amount: 581000 },
];

function fmtMoney(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

function DashboardPage() {
  const officialsTracked = officials.length;
  const billsMoving = bills.filter((b) => b.status !== "Signed" && b.status !== "Failed").length;
  const newFilingsThisWeek = 6; // sample
  const votesThisWeek = 14; // sample

  // Notable votes — curated mix across four distinct bills with a realistic
  // Yea/Nay split. Mendez's Nay on HR-2241 matches the Daily Brief above.
  const notableVotes: {
    billId: string;
    billTitle: string;
    officialId: string;
    vote: "Yea" | "Nay";
  }[] = [
    {
      billId: "bill-hr-2241",
      billTitle: "HR-2241 — Public Transit Modernization Act",
      officialId: "fed-rep-tx07-mendez",
      vote: "Nay",
    },
    {
      billId: "bill-sb-118",
      billTitle: "SB-118 — Renter Stability & Cap Reform",
      officialId: "ca-sen-11-ortiz",
      vote: "Yea",
    },
    {
      billId: "bill-hb-991",
      billTitle: "HB-991 — Oil & Gas Setback Rollback",
      officialId: "tx-rep-78-callahan",
      vote: "Yea",
    },
    {
      billId: "bill-ord-44",
      billTitle: "Ord. 44-2026 — Lobbyist 48-Hour Disclosure",
      officialId: "local-cc-sf-5-abernathy",
      vote: "Nay",
    },
  ];

  const billsMovingList = bills
    .filter((b) => b.status !== "Signed" && b.status !== "Failed")
    .slice(0, 5);

  const sectorMax = Math.max(...sectors.map((s) => s.amount));

  // Static-but-formatted Daily Brief lines. Each links to a real record page.
  const brief: { text: string; sources: { label: string; to: "/officials/$id" | "/bills"; id?: string }[] }[] = [
    {
      text: `${billsMoving} bills are currently moving across federal, state, and local dockets tracked in this demo.`,
      sources: [{ label: "bills", to: "/bills" }],
    },
    {
      text: "Rep. Hector Mendez voted Nay on HR-2241 (Public Transit Modernization Act) in committee.",
      sources: [
        { label: "mendez", to: "/officials/$id", id: "fed-rep-tx07-mendez" },
        { label: "hr-2241", to: "/bills" },
      ],
    },
    {
      text: "State Sen. Rosa Ortiz co-sponsored SB-118 (Renter Stability & Cap Reform); the bill has Passed its chamber.",
      sources: [
        { label: "ortiz", to: "/officials/$id", id: "ca-sen-11-ortiz" },
        { label: "sb-118", to: "/bills" },
      ],
    },
    {
      text: "Ord. 44-2026 (Lobbyist 48-Hour Disclosure), sponsored by Councilmember Tam Nguyen, has been Signed into law.",
      sources: [
        { label: "nguyen", to: "/officials/$id", id: "local-cc-sf-3-nguyen" },
        { label: "ord-44", to: "/bills" },
      ],
    },
  ];

  return (
    <AppShell>
      <div className="px-4 md:px-8 py-8 max-w-[1400px] mx-auto">
        {/* Lens switcher */}
        <div className="mb-6 flex items-center gap-2 flex-wrap">
          <span className="mono-label mr-1 hidden sm:inline">LENS</span>
          {lenses.map((l) => {
            const base =
              "inline-flex items-center gap-1.5 px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest border rounded-sm transition";
            if (l.active) {
              return (
                <span
                  key={l.id}
                  className={`${base} bg-amber text-primary-foreground border-amber`}
                >
                  <LayoutDashboard className="h-3 w-3" />
                  {l.label}
                </span>
              );
            }
            if (l.soon) {
              return (
                <button
                  key={l.id}
                  disabled
                  aria-disabled
                  className={`${base} border-border text-muted-foreground/60 cursor-not-allowed`}
                >
                  {l.label}
                  <span className="ml-1 px-1 py-px text-[9px] tracking-widest border border-border rounded-[2px] text-muted-foreground">
                    SOON
                  </span>
                </button>
              );
            }
            return (
              <Link
                key={l.id}
                to={l.to!}
                className={`${base} border-border text-muted-foreground hover:text-foreground hover:border-amber/60 hover:bg-surface-2`}
              >
                {l.id === "feed" ? <Radio className="h-3 w-3" /> : <ScrollText className="h-3 w-3" />}
                {l.label}
              </Link>
            );
          })}
        </div>

        <SectionHeader
          eyebrow="FLORIDA // SITUATIONAL OVERVIEW"
          title="The Brief"
          right={
            <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest border border-amber/40 text-amber px-2 py-1 rounded-[2px]">
              <span className="h-1.5 w-1.5 rounded-full bg-amber" />
              FLORIDA · BETA
            </span>
          }
        />

        {/* KPI row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          <StatTile
            label="OFFICIALS TRACKED"
            value={officialsTracked}
            sub="across fed / state / local"
            icon={UsersIcon}
          />
          <StatTile
            label="BILLS MOVING"
            value={billsMoving}
            sub="not yet signed or failed"
            icon={ScrollText}
          />

          <StatTile
            label="NEW FILINGS · 7D"
            value={newFilingsThisWeek}
            sub="sample · disclosure feeds"
            icon={FileText}
          />
          <StatTile
            label="VOTES · 7D"
            value={votesThisWeek}
            sub="sample · floor + committee"
            icon={Vote}
          />

        </div>

        {/* Daily Brief */}
        <section className="border border-border bg-surface rounded-sm p-5 md:p-6 mb-8 relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-amber" />
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="mono-label text-amber flex items-center gap-1.5">
                <Activity className="h-3 w-3" />
                DAILY BRIEF · AI SUMMARY OF VERIFIED RECORDS
              </div>
              <p className="mt-1 text-[12px] text-muted-foreground">
                Every line links to its source. No opinions, no predictions.
              </p>
            </div>
            <span className="mono-label">{new Date().toISOString().slice(0, 10)}</span>
          </div>

          <ol className="mt-4 space-y-3">
            {brief.map((line, i) => (
              <li
                key={i}
                className="flex items-start gap-3 border-t border-border/60 pt-3 first:border-t-0 first:pt-0"
              >
                <span className="font-mono text-[10px] text-muted-foreground pt-0.5 w-6 shrink-0">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground leading-snug">{line.text}</p>
                  <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                    {line.sources.map((s, j) =>
                      s.to === "/officials/$id" && s.id ? (
                        <Link
                          key={j}
                          to="/officials/$id"
                          params={{ id: s.id }}
                          className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-cyan border border-border hover:border-cyan px-1.5 py-0.5 rounded-[2px] transition"
                        >
                          SRC · {s.label}
                        </Link>
                      ) : (
                        <Link
                          key={j}
                          to="/bills"
                          className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-cyan border border-border hover:border-cyan px-1.5 py-0.5 rounded-[2px] transition"
                        >
                          SRC · {s.label}
                        </Link>
                      ),
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Two-column area */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Money */}
          <section className="border border-border bg-surface rounded-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="mono-label text-amber flex items-center gap-1.5">
                <DollarSign className="h-3 w-3" />
                MONEY · TOP SECTORS (THIS CYCLE)
              </div>
              <span className="mono-label">SAMPLE</span>
            </div>
            <ul className="space-y-3">
              {sectors.map((s) => {
                const pct = Math.round((s.amount / sectorMax) * 100);
                return (
                  <li key={s.label}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-foreground">{s.label}</span>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {fmtMoney(s.amount)}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1 w-full bg-surface-2 rounded-[1px] overflow-hidden">
                      <div
                        className="h-full bg-amber/70"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Right stack */}
          <div className="space-y-6">
            {/* Notable votes */}
            <section className="border border-border bg-surface rounded-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="mono-label text-cyan flex items-center gap-1.5">
                  <Vote className="h-3 w-3" />
                  NOTABLE VOTES
                </div>
                <Link
                  to="/bills"
                  className="mono-label text-muted-foreground hover:text-amber"
                >
                  ALL →
                </Link>
              </div>
              <ul className="divide-y divide-border border border-border rounded-sm bg-background/40">
                {notableVotes.map((v, i) => {
                  const o = getOfficial(v.officialId);
                  if (!o) return null;
                  const isYea = v.vote === "Yea";
                  const isNay = v.vote === "Nay";
                  const voteColor = isYea
                    ? "text-status-green border-status-green/50 bg-status-green/10"
                    : isNay
                      ? "text-status-red border-status-red/50 bg-status-red/10"
                      : "text-muted-foreground border-border";
                  return (
                    <li key={`${v.billId}-${v.officialId}-${i}`} className="flex items-center gap-3 px-3 py-2">
                      <OfficialAvatar official={o} size={26} />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold truncate">{v.billTitle}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <PartyDot party={o.party} />
                          <Link
                            to="/officials/$id"
                            params={{ id: o.id }}
                            className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-amber truncate"
                          >
                            {o.name}
                          </Link>
                        </div>
                      </div>
                      <span
                        className={`shrink-0 font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 border rounded-[2px] ${voteColor}`}
                      >
                        {v.vote}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* Bills moving */}
            <section className="border border-border bg-surface rounded-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="mono-label text-amber flex items-center gap-1.5">
                  <ScrollText className="h-3 w-3" />
                  BILLS MOVING
                </div>
                <Link
                  to="/bills"
                  className="mono-label text-muted-foreground hover:text-amber"
                >
                  ALL →
                </Link>
              </div>
              <ul className="space-y-2">
                {billsMovingList.map((b) => (
                  <li
                    key={b.id}
                    className="flex items-start gap-3 border border-border rounded-sm px-3 py-2 bg-background/40"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold leading-snug truncate">{b.title}</div>
                      <div className="mt-0.5 mono-label">
                        {b.level.toUpperCase()} · {b.tags.slice(0, 2).join(" · ")}
                      </div>
                    </div>
                    <BillStatusPill status={b.status} />
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border pt-4 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[11px] text-muted-foreground font-mono uppercase tracking-wider">
            Public records only · every claim links to a primary source
          </p>
          <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest border border-amber/40 text-amber px-2 py-1 rounded-[2px]">
            <span className="h-1.5 w-1.5 rounded-full bg-amber" />
            Sample data — not real records
          </span>
        </div>
      </div>
    </AppShell>
  );
}
