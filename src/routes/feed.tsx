import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import {
  ActionCard,
  LevelFilterBar,
  SectionHeader,
} from "@/components/polysnitch/Primitives";
import {
  actions,
  getOfficial,
  threads,
  topFunded,
  trendingThreadIds,
} from "@/lib/mock-data";
import { TrendingUp, MessageSquare } from "lucide-react";

export const Route = createFileRoute("/feed")({
  head: () => ({
    meta: [
      { title: "Feed · PolySnitch Watchfloor" },
      { name: "description", content: "Live feed of public actions by officials in your area." },
    ],
  }),
  component: FeedPage,
});

function FeedPage() {
  const [level, setLevel] = useState<"all" | "federal" | "state" | "local">("all");
  const filtered = useMemo(
    () => (level === "all" ? actions : actions.filter((a) => {
      const o = getOfficial(a.officialId);
      return o?.level === level;
    })),
    [level],
  );

  return (
    <AppShell>
      <div className="px-4 md:px-8 py-6 md:py-8 max-w-[1600px] mx-auto">
        <SectionHeader
          eyebrow="WATCHFLOOR // LIVE"
          title="Feed"
          right={
            <span className="mono-label hidden md:inline">
              {filtered.length} ACTIONS · STREAMING
            </span>
          }
        />

        <div className="mb-5">
          <LevelFilterBar value={level} onChange={setLevel} location="San Vicente, CA · CA-12" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          <div className="space-y-3 min-w-0">
            {filtered.slice(0, 40).map((a) => {
              const o = getOfficial(a.officialId)!;
              return <ActionCard key={a.id} action={a} official={o} />;
            })}
          </div>

          {/* Right rail (desktop) */}
          <aside className="hidden lg:block space-y-6">
            <div className="border border-border bg-surface rounded-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-3.5 w-3.5 text-amber" />
                <span className="mono-label text-amber">TRENDING IN YOUR DISTRICT</span>
              </div>
              <ul className="space-y-3">
                {trendingThreadIds.map((id, i) => {
                  const t = threads.find((x) => x.id === id);
                  if (!t) return null;
                  return (
                    <li key={id}>
                      <Link
                        to="/discuss/$id"
                        params={{ id: t.id }}
                        className="block group"
                      >
                        <div className="flex items-start gap-2">
                          <span className="font-mono text-[11px] text-muted-foreground mt-0.5">
                            #{String(i + 1).padStart(2, "0")}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium leading-snug group-hover:text-amber line-clamp-2">
                              {t.title}
                            </p>
                            <div className="mt-1 flex items-center gap-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                              <span>▲ {t.upvotes}</span>
                              <span className="flex items-center gap-1">
                                <MessageSquare className="h-2.5 w-2.5" />
                                {t.comments.length}
                              </span>
                              <span>{t.scope}</span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="border border-border bg-surface rounded-sm p-4">
              <div className="mono-label text-cyan mb-3">MOST-FUNDED NEAR YOU</div>
              <ol className="space-y-2">
                {topFunded.map((f, i) => {
                  const o = getOfficial(f.officialId)!;
                  return (
                    <li key={f.officialId}>
                      <Link
                        to="/officials/$id"
                        params={{ id: f.officialId }}
                        className="flex items-center gap-3 group"
                      >
                        <span className="font-mono text-xs text-muted-foreground w-5">
                          {i + 1}.
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate group-hover:text-amber">
                            {o.name}
                          </div>
                          <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                            {o.office} · {o.district}
                          </div>
                        </div>
                        <span className="font-mono text-sm text-amber tabular-nums shrink-0">
                          ${(f.total / 1000).toFixed(0)}k
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
              <div className="mt-3 mono-label">SOURCE · PUBLIC CAMPAIGN FILINGS</div>
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
