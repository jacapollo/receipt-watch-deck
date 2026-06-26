import { createFileRoute, Link } from "@tanstack/react-router";
import { DollarSign, Activity, Users as UsersIcon, Building2, TrendingUp, Coins } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { LensSwitcher } from "@/components/polysnitch/LensSwitcher";
import {
  OfficialAvatar,
  PartyDot,
  SectionHeader,
  StatTile,
} from "@/components/polysnitch/Primitives";
import { funding, officials } from "@/lib/mock-data";
import type { FundingItem } from "@/lib/mock-data";


export const Route = createFileRoute("/money")({
  head: () => ({
    meta: [
      { title: "Money · PolySnitch" },
      {
        name: "description",
        content:
          "Funding radar: aggregated public-record campaign finance across the delegation by sector, source type, donor, and recipient.",
      },
    ],
  }),
  component: MoneyPage,
});

function fmtMoney(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

function sumBy<T>(arr: T[], pick: (t: T) => number) {
  return arr.reduce((acc, x) => acc + pick(x), 0);
}

function groupSum<T>(arr: T[], key: (t: T) => string, pick: (t: T) => number) {
  const map = new Map<string, number>();
  for (const x of arr) {
    const k = key(x);
    map.set(k, (map.get(k) ?? 0) + pick(x));
  }
  return Array.from(map.entries())
    .map(([label, amount]) => ({ label, amount }))
    .sort((a, b) => b.amount - a.amount);
}

const SAMPLE_SOURCE = { src: "fec.gov", url: "https://www.fec.gov" };

function SrcChip({ label }: { label: string }) {
  return (
    <a
      href={SAMPLE_SOURCE.url}
      target="_blank"
      rel="noreferrer"
      className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-cyan border border-border hover:border-cyan px-1.5 py-0.5 rounded-[2px] transition"
    >
      SRC · {label}
    </a>
  );
}

function MoneyPage() {
  // Flatten everything
  const allFunding: (FundingItem & { officialId: string })[] = [];
  for (const o of officials) {
    const items = funding[o.id] ?? [];
    for (const it of items) allFunding.push({ ...it, officialId: o.id });
  }

  const total = sumBy(allFunding, (f) => f.amount);
  // Interest sectors only — exclude source-type buckets that already appear under "By source type".
  const NON_SECTOR_TYPES = new Set(["Individual", "Party", "Self"]);
  const interestFunding = allFunding.filter((f) => !NON_SECTOR_TYPES.has(f.type));
  const bySector = groupSum(interestFunding, (f) => f.sector, (f) => f.amount);
  const byType = groupSum(allFunding, (f) => f.type, (f) => f.amount);
  const topDonors = groupSum(allFunding, (f) => f.donor, (f) => f.amount).slice(0, 8);
  // Lookup sector for donor (most common)
  const donorMeta = new Map<string, { sector: string; type: string }>();
  for (const f of allFunding) {
    if (!donorMeta.has(f.donor)) donorMeta.set(f.donor, { sector: f.sector, type: f.type });
  }

  const pacAmount = byType.find((b) => b.label === "PAC")?.amount ?? 0;
  const pacPct = total ? Math.round((pacAmount / total) * 100) : 0;
  const topSector = bySector[0];
  const donorsTracked = allFunding.length;
  const largestDonor = topDonors[0];

  // Per-official totals — use official's stated topSector as the interest sector
  const perOfficial = officials
    .map((o) => {
      const items = funding[o.id] ?? [];
      const officialTotal = sumBy(items, (i) => i.amount);
      return { official: o, total: officialTotal, topSector: o.stats.topSector };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);

  const sectorMax = Math.max(...bySector.map((s) => s.amount));
  const typeMax = Math.max(...byType.map((s) => s.amount));

  const brief = [
    {
      text: `${topSector.label} is the top source across the delegation at ${fmtMoney(topSector.amount)} cycle to date.`,
      sources: [{ label: topSector.label.toLowerCase().replace(/\s+/g, "-") }],
    },
    {
      text: `PAC money is ${pacPct}% of total raised this cycle (${fmtMoney(pacAmount)} of ${fmtMoney(total)}).`,
      sources: [{ label: "pac-totals" }, { label: "fec" }],
    },
    {
      text: `Largest single donor across the delegation: ${largestDonor.label} at ${fmtMoney(largestDonor.amount)}.`,
      sources: [{ label: largestDonor.label.split(" ")[0].toLowerCase() }],
    },
  ];

  return (
    <AppShell>
      <div className="px-4 md:px-8 py-8 max-w-[1400px] mx-auto">
        <LensSwitcher active="money" />

        <SectionHeader
          eyebrow="FLORIDA // FUNDING RADAR"
          title="Money"
          right={
            <div className="flex items-center gap-2">
              <span className="mono-label hidden sm:inline">CYCLE TO DATE</span>
              <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest border border-amber/40 text-amber px-2 py-1 rounded-[2px]">
                <span className="h-1.5 w-1.5 rounded-full bg-amber" />
                FLORIDA · BETA
              </span>
            </div>
          }
        />

        {/* KPI row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          <StatTile label="TOTAL RAISED" value={fmtMoney(total)} sub="cycle to date · all officials" icon={DollarSign} />
          <StatTile label="FROM PACs" value={`${pacPct}%`} sub={`${fmtMoney(pacAmount)} of total`} icon={Building2} />
          <StatTile label="TOP SECTOR" value={topSector.label} sub={fmtMoney(topSector.amount)} icon={TrendingUp} />
          <StatTile label="DONORS TRACKED" value={donorsTracked} sub="line items · public filings" icon={UsersIcon} />
        </div>

        {/* Money brief */}
        <section className="border border-border bg-surface rounded-sm p-5 md:p-6 mb-8 relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-amber" />
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="mono-label text-amber flex items-center gap-1.5">
                <Activity className="h-3 w-3" />
                MONEY BRIEF · AI SUMMARY OF VERIFIED RECORDS
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
                    {line.sources.map((s, j) => (
                      <SrcChip key={j} label={s.label} />
                    ))}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Two-column area */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* By sector */}
          <section className="border border-border bg-surface rounded-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="mono-label text-amber flex items-center gap-1.5">
                <TrendingUp className="h-3 w-3" />
                BY SECTOR (CYCLE TO DATE)
              </div>
              <span className="mono-label">SAMPLE</span>
            </div>
            <ul className="space-y-3">
              {bySector.map((s) => {
                const pct = Math.round((s.amount / sectorMax) * 100);
                return (
                  <li key={s.label}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-foreground">{s.label}</span>
                      <span className="font-mono text-[11px] text-foreground tabular-nums">
                        {fmtMoney(s.amount)}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1 w-full bg-surface-2 rounded-[1px] overflow-hidden">
                      <div className="h-full bg-foreground/70" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* By source type */}
          <section className="border border-border bg-surface rounded-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="mono-label text-cyan flex items-center gap-1.5">
                <Coins className="h-3 w-3" />
                BY SOURCE TYPE
              </div>
              <span className="mono-label">SHARE OF TOTAL</span>
            </div>
            <ul className="space-y-3">
              {byType.map((t) => {
                const pct = Math.round((t.amount / typeMax) * 100);
                const share = total ? Math.round((t.amount / total) * 100) : 0;
                return (
                  <li key={t.label}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-foreground">{t.label}</span>
                      <span className="font-mono text-[11px] text-foreground tabular-nums">
                        {fmtMoney(t.amount)} · {share}%
                      </span>
                    </div>
                    <div className="mt-1.5 h-1 w-full bg-surface-2 rounded-[1px] overflow-hidden">
                      <div className="h-full bg-foreground/70" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        {/* Top donors */}
        <section className="border border-border bg-surface rounded-sm p-5 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="mono-label text-amber flex items-center gap-1.5">
              <DollarSign className="h-3 w-3" />
              TOP DONORS
            </div>
            <span className="mono-label">TOP {topDonors.length}</span>
          </div>
          <ul className="divide-y divide-border border border-border rounded-sm bg-background/40">
            {topDonors.map((d) => {
              const meta = donorMeta.get(d.label)!;
              return (
                <li key={d.label} className="flex items-center gap-3 px-3 py-2.5 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold truncate">{d.label}</div>
                    <div className="mono-label mt-0.5">{meta.sector}</div>
                  </div>
                  <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 border border-border rounded-[2px] text-muted-foreground">
                    {meta.type}
                  </span>
                  <span className="shrink-0 font-mono text-sm text-foreground tabular-nums w-20 text-right">
                    {fmtMoney(d.amount)}
                  </span>
                  <SrcChip label="filing" />
                </li>
              );
            })}
          </ul>
        </section>

        {/* Biggest recipients */}
        <section className="border border-border bg-surface rounded-sm p-5 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="mono-label text-cyan flex items-center gap-1.5">
              <UsersIcon className="h-3 w-3" />
              BIGGEST RECIPIENTS
            </div>
            <Link to="/officials" className="mono-label text-muted-foreground hover:text-amber">
              ALL →
            </Link>
          </div>
          <ul className="divide-y divide-border border border-border rounded-sm bg-background/40">
            {perOfficial.map(({ official: o, total: t, topSector: ts }) => (
              <li key={o.id} className="flex items-center gap-3 px-3 py-2.5">
                <OfficialAvatar official={o} size={32} />
                <div className="min-w-0 flex-1">
                  <Link
                    to="/officials/$id"
                    params={{ id: o.id }}
                    className="text-sm font-semibold hover:text-amber truncate block"
                  >
                    {o.name}
                  </Link>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <PartyDot party={o.party} />
                    <span className="mono-label truncate">
                      {o.office} · TOP: {ts}
                    </span>
                  </div>
                </div>
                <span className="shrink-0 font-mono text-sm text-foreground tabular-nums">
                  {fmtMoney(t)}
                </span>
              </li>
            ))}
          </ul>
        </section>

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
